import { Request, Response, NextFunction } from 'express';
import * as screenerService from './screener.service';
import { screenerRequestSchema } from './screener.schema';
import { AuthenticatedRequest } from '../../types';

export async function screen(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { market, indicators } = screenerRequestSchema.parse(req.body);

    const result = await screenerService.screenStocks(market, indicators, {
      sessionId: authReq.ctx.sessionId,
      requestId: authReq.ctx.requestId,
      userId: authReq.user.id,
      entitledIndicatorIds: authReq.user.entitledIndicatorIds,
    });

    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}
