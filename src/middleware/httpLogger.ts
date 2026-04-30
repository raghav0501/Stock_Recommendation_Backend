import morgan, { StreamOptions } from 'morgan';
import { Request, Response } from 'express';
import { logger } from '../infrastructure/logger';
import { AuthenticatedRequest } from '../types';

// Pipe Morgan output into Winston's http level
const stream: StreamOptions = {
  write: (message: string) => {
    logger.http(message.trim(), { service: 'http' });
  },
};

// Custom Morgan token for session & request IDs
morgan.token('session-id', (req: Request) => (req as AuthenticatedRequest).ctx?.sessionId ?? '-');
morgan.token('request-id', (req: Request) => (req as AuthenticatedRequest).ctx?.requestId ?? '-');
morgan.token('user-id',    (req: Request) => (req as AuthenticatedRequest).ctx?.userId ?? '-');

const format = ':method :url :status :res[content-length]B - :response-time ms | sid::session-id | rid::request-id | uid::user-id';

export const httpLogger = morgan(format, { stream });