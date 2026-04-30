import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { createServiceLogger } from '../infrastructure/logger';
import { AuthenticatedRequest } from '../types';

const log = createServiceLogger('error-handler');

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const ctx = (req as AuthenticatedRequest).ctx;

  if (err instanceof ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      status:  'error',
      code:    'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof Error) {
    const appErr   = err as AppError;
    const status   = appErr.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
    const code     = appErr.code ?? 'INTERNAL_ERROR';
    const isServer = status >= 500;

    if (isServer) {
      log.error('Unhandled server error', {
        sessionId: ctx?.sessionId,
        requestId: ctx?.requestId,
        userId:    ctx?.userId,
        meta: { message: appErr.message, stack: appErr.stack, path: req.path, method: req.method },
      });
    } else {
      log.warn('Client error', {
        sessionId: ctx?.sessionId,
        requestId: ctx?.requestId,
        meta: { message: appErr.message, status, code, path: req.path },
      });
    }

    res.status(status).json({
      status:  'error',
      code,
      message:
        isServer && process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : appErr.message,
    });
    return;
  }

  log.error('Unknown thrown value', {
    sessionId: ctx?.sessionId,
    requestId: ctx?.requestId,
    meta: { err: String(err), path: req.path },
  });

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    status:  'error',
    code:    'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    status:  'error',
    code:    'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}