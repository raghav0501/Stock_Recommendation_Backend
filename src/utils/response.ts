import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiSuccess, ApiError, ApiPartialSuccess } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = StatusCodes.OK): void {
  const body: ApiSuccess<T> = { status: 'success', data };
  res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, StatusCodes.CREATED);
}

export function sendError(res: Response, code: string, message: string, statusCode = StatusCodes.INTERNAL_SERVER_ERROR): void {
  const body: ApiError = { status: 'error', code, message };
  res.status(statusCode).json(body);
}

export function sendPartial<T>(
  res: Response,
  data: T,
  meta: Record<string, unknown>,
  errors?: Record<string, string>,
): void {
  const body: ApiPartialSuccess<T> = {
    status: 'success',
    data,
    meta: { generatedAt: new Date().toISOString(), dataSource: 'EOD', ...meta },
    ...(errors && Object.keys(errors).length ? { errors } : {}),
  };
  res.status(StatusCodes.OK).json(body);
}

// ── Normalise indicator list for cache keys and validation ─────────────────
export function normalizeIndicators(indicators: string[]): string[] {
  return [...indicators].map((i) => i.toUpperCase()).sort();
}

export function buildScreenerCacheKey(market: string, indicators: string[]): string {
  return `screen:v1:${market}:${normalizeIndicators(indicators).join('_')}`;
}