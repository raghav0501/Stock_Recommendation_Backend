/**
 * Auth service
 *
 * Token storage previously used Redis. It now uses Firestore:
 *   - refresh_tokens/{userId}   → encrypted refresh token + expiry
 *   - password_resets/{token}   → userId + expiry
 *
 * This is appropriate for the current small-user-base phase.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/postgres/client';
import { getFirestore, Collections } from '../../infrastructure/firebase/client';
import { createServiceLogger } from '../../infrastructure/logger';
import { JwtPayload, IndicatorMeta, MarketMeta } from '../../types';

const log = createServiceLogger('auth');

// ── Token helpers ──────────────────────────────────────────────────────────
function signAccessToken(userId: string, role: string): string {
  // Cast expiresIn to 'any' because config.JWT_EXPIRES_IN is typed as string
  // but jsonwebtoken's SignOptions expects the ms library's StringValue type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign({ sub: userId, role } as JwtPayload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as any,
  });
}

function generateRefreshToken(userId: string): string {
  // Embed userId so we can look up the Firestore doc directly without a scan
  return `${userId}:${crypto.randomBytes(48).toString('hex')}`;
}

function encryptToken(token: string): string {
  const key = Buffer.from(config.REFRESH_TOKEN_ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, dataHex] = encrypted.split(':');
  const key = Buffer.from(config.REFRESH_TOKEN_ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(authTag);
  return d.update(data).toString('utf8') + d.final('utf8');
}

async function storeRefreshToken(userId: string, rawToken: string): Promise<string> {
  const encrypted = encryptToken(rawToken);
  const expireAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await getFirestore()
    .collection(Collections.REFRESH_TOKENS)
    .doc(userId)
    .set({ encrypted, expireAt: expireAt.toISOString(), userId });

  return encrypted;
}

async function getStoredRefreshToken(userId: string): Promise<string | null> {
  const doc = await getFirestore()
    .collection(Collections.REFRESH_TOKENS)
    .doc(userId)
    .get();

  if (!doc.exists) return null;

  const data = doc.data() as { encrypted: string; expireAt: string };
  if (new Date(data.expireAt) < new Date()) {
    // Expired — clean up and reject
    await doc.ref.delete();
    return null;
  }

  return data.encrypted;
}

async function deleteRefreshToken(userId: string): Promise<void> {
  await getFirestore()
    .collection(Collections.REFRESH_TOKENS)
    .doc(userId)
    .delete();
}

// ── Session builder (shared by password login and OTP verification) ───────
export async function createSessionForUserId(
  userId: string,
  ctx: { sessionId: string; requestId: string },
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          roleIndicators: { include: { indicator: true } },
        },
      },
      preferences: true,
    },
  });

  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'USER_INACTIVE',
    });
  }

  const accessToken = signAccessToken(user.id, user.role.name);
  const rawRefresh  = generateRefreshToken(user.id);
  const encRefresh  = await storeRefreshToken(user.id, rawRefresh);
  const sessionId   = ctx.sessionId ?? uuidv4();
  const markets     = await prisma.market.findMany({ where: { isActive: true } });

  const entitledIndicators: IndicatorMeta[] = user.role.roleIndicators
    .filter((ri) => ri.indicator.isActive)
    .map((ri) => ({
      id:          ri.indicator.id,
      name:        ri.indicator.name,
      description: ri.indicator.description,
      category:    ri.indicator.category,
      scale:       ri.indicator.scale,
    }));

  return {
    accessToken,
    refreshToken: encRefresh,
    sessionId,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role.name,
      theme: user.preferences?.theme ?? 'light',
    },
    markets:            markets.map((m) => ({ id: m.id, name: m.name, exchange: m.exchange })),
    entitledIndicators,
  };
}

// ── Login ──────────────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    theme: string;
  };
  markets: MarketMeta[];
  entitledIndicators: IndicatorMeta[];
}

export async function loginUser(
  payload: LoginPayload,
  ctx: { sessionId: string; requestId: string },
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    include: {
      role: {
        include: {
          roleIndicators: { include: { indicator: true } },
        },
      },
      preferences: true,
    },
  });

  if (!user || !user.isActive) {
    log.warn('Login failed – user not found or inactive', {
      sessionId: ctx.sessionId, requestId: ctx.requestId,
      meta: { email: payload.email },
    });
    throw Object.assign(new Error('Invalid credentials'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_CREDENTIALS',
    });
  }

  const passwordMatch = await bcrypt.compare(payload.password, user.passwordHash);
  if (!passwordMatch) {
    log.warn('Login failed – wrong password', {
      sessionId: ctx.sessionId, requestId: ctx.requestId,
      meta: { email: payload.email },
    });
    throw Object.assign(new Error('Invalid credentials'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_CREDENTIALS',
    });
  }

  const accessToken = signAccessToken(user.id, user.role.name);
  const rawRefresh = generateRefreshToken(user.id);
  const encRefresh = await storeRefreshToken(user.id, rawRefresh);
  const sessionId = ctx.sessionId ?? uuidv4();

  const markets = await prisma.market.findMany({ where: { isActive: true } });

  const entitledIndicators: IndicatorMeta[] = user.role.roleIndicators
    .filter((ri) => ri.indicator.isActive)
    .map((ri) => ({
      id: ri.indicator.id,
      name: ri.indicator.name,
      description: ri.indicator.description,
      category: ri.indicator.category,
      scale: ri.indicator.scale,
    }));

  log.info('User logged in', {
    sessionId, requestId: ctx.requestId, userId: user.id,
    meta: { role: user.role.name },
  });

  return {
    accessToken,
    refreshToken: encRefresh,
    sessionId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      theme: user.preferences?.theme ?? 'light',
    },
    markets: markets.map((m) => ({ id: m.id, name: m.name, exchange: m.exchange })),
    entitledIndicators,
  };
}

// ── Refresh Token ──────────────────────────────────────────────────────────
export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export async function refreshUserToken(
  encryptedRefreshToken: string,
  ctx: { sessionId: string; requestId: string },
): Promise<RefreshResult & { userId: string }> {
  let rawToken: string;
  try {
    rawToken = decryptToken(encryptedRefreshToken);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_REFRESH_TOKEN',
    });
  }

  // Extract userId from token payload (format: "userId:hexRandom")
  const separatorIndex = rawToken.indexOf(':');
  if (separatorIndex === -1) {
    throw Object.assign(new Error('Malformed refresh token'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_REFRESH_TOKEN',
    });
  }
  const ownerId = rawToken.slice(0, separatorIndex);

  // Look up stored token directly by userId — O(1), no scan
  const storedEncrypted = await getStoredRefreshToken(ownerId);
  if (!storedEncrypted || storedEncrypted !== encryptedRefreshToken) {
    throw Object.assign(new Error('Refresh token not found or expired'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const user = await prisma.user.findUnique({
    where:   { id: ownerId },
    include: { role: true },
  });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_REFRESH_TOKEN',
    });
  }

  // Token rotation — delete old, issue new
  await deleteRefreshToken(ownerId);
  const newAccessToken = signAccessToken(user.id, user.role.name);
  const newRawRefresh  = generateRefreshToken(ownerId);
  const newEncRefresh  = await storeRefreshToken(ownerId, newRawRefresh);

  log.info('Token refreshed', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ownerId,
  });

  return { accessToken: newAccessToken, refreshToken: newEncRefresh, userId: ownerId };
}

// ── Logout ─────────────────────────────────────────────────────────────────
export async function logoutUser(
  userId: string,
  ctx: { sessionId: string; requestId: string },
): Promise<void> {
  await deleteRefreshToken(userId);
  log.info('User logged out', { sessionId: ctx.sessionId, requestId: ctx.requestId, userId });
}

// ── Password Reset ─────────────────────────────────────────────────────────
export async function requestPasswordReset(
  email: string,
  ctx: { requestId: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    log.info('Password reset requested for unknown email', {
      requestId: ctx.requestId, meta: { email },
    });
    return; // Prevent email enumeration
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expireAt = new Date(Date.now() + config.PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000);

  await getFirestore()
    .collection(Collections.PASSWORD_RESETS)
    .doc(token)
    .set({ userId: user.id, expireAt: expireAt.toISOString() });

  log.info('Password reset token generated', { requestId: ctx.requestId, userId: user.id });
  // TODO: await emailService.sendPasswordReset(email, token);
}

export async function resetPassword(
  token: string,
  newPassword: string,
  ctx: { requestId: string },
): Promise<void> {
  const docRef  = getFirestore().collection(Collections.PASSWORD_RESETS).doc(token);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw Object.assign(new Error('Invalid or expired reset token'), {
      statusCode: StatusCodes.BAD_REQUEST, code: 'INVALID_RESET_TOKEN',
    });
  }

  const data = docSnap.data() as { userId: string; expireAt: string };
  if (new Date(data.expireAt) < new Date()) {
    await docRef.delete();
    throw Object.assign(new Error('Reset token has expired'), {
      statusCode: StatusCodes.BAD_REQUEST, code: 'INVALID_RESET_TOKEN',
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: data.userId }, data: { passwordHash } });

  // Clean up both tokens
  await Promise.all([
    docRef.delete(),
    deleteRefreshToken(data.userId),
  ]);

  log.info('Password reset successful', { requestId: ctx.requestId, userId: data.userId });
}