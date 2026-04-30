import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { prisma } from '../infrastructure/database/postgres/client';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { sendError } from '../utils/response';
import { createServiceLogger } from '../infrastructure/logger';

const log = createServiceLogger('auth-middleware');

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'MISSING_TOKEN', 'Authorization header is required', StatusCodes.UNAUTHORIZED);
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    const authReq = req as AuthenticatedRequest;
    authReq.user = {
      id: payload.sub,
      role: payload.role,
      entitledIndicatorIds: [], // populated by loadEntitlements middleware
    };
    authReq.ctx = {
      ...authReq.ctx,
      userId: payload.sub,
      userRole: payload.role,
    };

    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    log.warn('JWT verification failed', { meta: { err: String(err) } });
    sendError(res, 'INVALID_TOKEN', message, StatusCodes.UNAUTHORIZED);
  }
}

/**
 * Must run after authenticate().
 * Loads the user's entitled indicator IDs from Postgres and attaches them to req.user.
 */
export function loadEntitlements(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;

  prisma.roleIndicator
    .findMany({
      where: {
        role: { users: { some: { id: authReq.user.id } } },
      },
      select: { indicatorId: true },
    })
    .then((rows) => {
      authReq.user.entitledIndicatorIds = rows.map((r) => r.indicatorId);
      authReq.ctx.entitledIndicatorIds  = authReq.user.entitledIndicatorIds;
      next();
    })
    .catch((err: unknown) => {
      log.error('Failed to load entitlements', { meta: { err: String(err) }, userId: authReq.user.id });
      sendError(res, 'ENTITLEMENT_ERROR', 'Failed to load user entitlements', StatusCodes.INTERNAL_SERVER_ERROR);
    });
}

/**
 * Role guard factory – usage: requireRole('developer')
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!roles.includes(authReq.user?.role ?? '')) {
      sendError(res, 'FORBIDDEN', 'Insufficient role', StatusCodes.FORBIDDEN);
      return;
    }
    next();
  };
}