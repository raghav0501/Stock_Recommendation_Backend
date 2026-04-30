import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthenticatedRequest } from '../types';
import { sendError } from '../utils/response';
import { normalizeIndicators } from '../utils/response';

/**
 * Validates that requested indicators are:
 * 1. Between 1 and 4 in count
 * 2. All within the user's entitled set
 *
 * Expects req.body.indicators or req.query.indicators to be a string[]
 */
export function enforceIndicatorEntitlement(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;

  const raw: unknown = req.body?.indicators ?? req.query?.indicators;
  const indicators: string[] = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];

  if (indicators.length === 0 || indicators.length > 4) {
    sendError(
      res,
      'INVALID_INDICATOR_COUNT',
      'You must select between 1 and 4 indicators',
      StatusCodes.BAD_REQUEST,
    );
    return;
  }

  const normalised = normalizeIndicators(indicators);
  const entitled   = new Set(authReq.user.entitledIndicatorIds);
  const disallowed = normalised.filter((id) => !entitled.has(id));

  if (disallowed.length > 0) {
    sendError(
      res,
      'INDICATOR_NOT_ENTITLED',
      `You are not entitled to the following indicators: ${disallowed.join(', ')}`,
      StatusCodes.FORBIDDEN,
    );
    return;
  }

  // Attach normalised indicators back onto body for downstream use
  req.body.indicators = normalised;
  next();
}