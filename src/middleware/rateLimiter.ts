/**
 * Rate limiter — in-memory store (express-rate-limit default).
 * Sufficient for the current small-user-base phase.
 * When scaling to multiple instances, swap the store for a
 * Firestore-backed or Cloud Memorystore (Redis) store.
 */
import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max:      config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  'error',
    code:    'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  },
  keyGenerator: (req) => {
    const userId = (req as { user?: { id?: string } }).user?.id;
    return userId ?? req.ip ?? 'unknown';
  },
});