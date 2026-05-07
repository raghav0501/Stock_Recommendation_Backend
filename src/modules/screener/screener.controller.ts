import { Request, Response, NextFunction } from 'express';
import { screenerRequestSchema } from './screener.schema';
import { screenStocks, getSignals } from './screener.service';
import { AuthenticatedRequest } from '../../types';

export async function screen(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = screenerRequestSchema.parse(req.body);

    // Support both { filters: {...} } and { indicators: [...] } forms
    const filters: Record<string, unknown> = body.filters ??
      Object.fromEntries((body.indicators ?? []).map((k) => [k, {}]));

    const result = await screenStocks(body.exchange, filters, {
      sessionId: authReq.ctx.sessionId,
      requestId: authReq.ctx.requestId,
      userId:    authReq.user.id,
    });

    res.json(result); // Return Python response as-is
  } catch (err) {
    next(err);
  }
}

export async function signals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const result  = await getSignals({
      sessionId: authReq.ctx.sessionId,
      requestId: authReq.ctx.requestId,
      userId:    authReq.user.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}