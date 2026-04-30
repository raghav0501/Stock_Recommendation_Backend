import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types';

/**
 * Extracts x-session-id from the incoming request (generated at login, stable per session).
 * Generates a fresh requestId (UUID v4) per request.
 * Attaches both to req.ctx and forwards them as response headers.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionId = (req.headers['x-session-id'] as string | undefined) ?? uuidv4();
  const requestId = uuidv4();

  (req as AuthenticatedRequest).ctx = {
    sessionId,
    requestId,
  };

  // Echo both IDs back so the frontend / pipelines can log them
  res.setHeader('x-session-id', sessionId);
  res.setHeader('x-request-id', requestId);

  next();
}