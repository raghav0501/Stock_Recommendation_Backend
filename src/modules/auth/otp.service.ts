import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/postgres/client';
import { sendOtpEmail } from '../../utils/email';
import { createServiceLogger } from '../../infrastructure/logger';
import { createSessionForUserId, LoginResult } from './auth.service';

const log = createServiceLogger('otp');

function generateOtp(): string {
  // crypto.randomInt is cryptographically secure and avoids modulo bias
  return crypto.randomInt(100_000, 1_000_000).toString();
}

function hashOtp(otp: string): string {
  return crypto
    .createHmac('sha256', config.OTP_HMAC_SECRET)
    .update(otp)
    .digest('hex');
}

// ── Request OTP ────────────────────────────────────────────────────────────
export async function requestOtp(
  email: string,
  ctx: { sessionId: string; requestId: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    // Return silently — same response as success to prevent email enumeration
    log.info('OTP requested for unknown/inactive email', {
      requestId: ctx.requestId, meta: { email },
    });
    return;
  }

  // Enforce cooling period: reject if a valid OTP was issued within the last OTP_COOLING_SECONDS
  const existing = await prisma.emailOtp.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const cooldownEnds = new Date(existing.createdAt.getTime() + config.OTP_COOLING_SECONDS * 1000);
    if (cooldownEnds > new Date()) {
      const retryAfterSeconds = Math.ceil((cooldownEnds.getTime() - Date.now()) / 1000);
      log.warn('OTP request blocked by cooling period', {
        requestId: ctx.requestId, userId: user.id,
        meta: { retryAfterSeconds },
      });
      throw Object.assign(
        new Error(`Please wait ${retryAfterSeconds} second(s) before requesting a new OTP`),
        { statusCode: StatusCodes.TOO_MANY_REQUESTS, code: 'OTP_COOLDOWN', retryAfterSeconds },
      );
    }
    // Stale OTPs for this email are no longer needed
    await prisma.emailOtp.deleteMany({ where: { email } });
  }

  const otp       = generateOtp();
  const otpHash   = hashOtp(otp);
  const expiresAt = new Date(Date.now() + config.OTP_TTL_SECONDS * 1000);

  await prisma.emailOtp.create({ data: { email, otpHash, expiresAt } });

  await sendOtpEmail(email, otp);

  log.info('OTP generated and sent', { requestId: ctx.requestId, userId: user.id });
}

// ── Verify OTP ─────────────────────────────────────────────────────────────
export async function verifyOtp(
  email: string,
  otp: string,
  ctx: { sessionId: string; requestId: string },
): Promise<LoginResult> {
  const record = await prisma.emailOtp.findFirst({
    where:   { email },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw Object.assign(new Error('Invalid or expired OTP'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_OTP',
    });
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailOtp.deleteMany({ where: { email } });
    throw Object.assign(new Error('OTP has expired'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'OTP_EXPIRED',
    });
  }

  if (record.otpHash !== hashOtp(otp)) {
    log.warn('OTP verification failed – wrong code', {
      requestId: ctx.requestId, meta: { email },
    });
    throw Object.assign(new Error('Invalid OTP'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'INVALID_OTP',
    });
  }

  // Delete OTP immediately after successful verification (single-use)
  await prisma.emailOtp.deleteMany({ where: { email } });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), {
      statusCode: StatusCodes.UNAUTHORIZED, code: 'USER_INACTIVE',
    });
  }

  log.info('OTP verified successfully', { requestId: ctx.requestId, userId: user.id });

  return createSessionForUserId(user.id, ctx);
}
