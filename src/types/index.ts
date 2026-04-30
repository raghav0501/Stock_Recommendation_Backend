import { Request } from 'express';

// ── Authenticated request context ─────────────────────────────────────────
export interface RequestContext {
  sessionId: string;  // stable per login session (from x-session-id header)
  requestId: string;  // per-request UUID
  userId?: string;
  userRole?: string;
  entitledIndicatorIds?: string[];
}

export interface AuthenticatedRequest extends Request {
  ctx: RequestContext;
  user: {
    id: string;
    role: string;
    entitledIndicatorIds: string[];
  };
}

// ── JWT payload ────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;   // userId
  role: string;
  iat?: number;
  exp?: number;
}

// ── Standard API response envelope ────────────────────────────────────────
export interface ApiSuccess<T> {
  status: 'success';
  data: T;
}

export interface ApiError {
  status: 'error';
  code: string;
  message: string;
}

// Partial success (used for Stock Detail with parallel pipeline calls)
export interface ApiPartialSuccess<T> {
  status: 'success';
  data: T;
  meta: {
    generatedAt: string;
    dataSource: 'EOD';
    [key: string]: unknown;
  };
  errors?: Record<string, string>;
}

// ── Roles ──────────────────────────────────────────────────────────────────
export type UserRole = 'standard' | 'premium' | 'developer';

// ── Indicator metadata ─────────────────────────────────────────────────────
export interface IndicatorMeta {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  scale: string;
}

// ── Market metadata ────────────────────────────────────────────────────────
export interface MarketMeta {
  id: string;
  name: string;
  exchange: string;
}