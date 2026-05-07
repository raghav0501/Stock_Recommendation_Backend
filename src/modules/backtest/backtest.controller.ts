import { Request, Response, NextFunction } from 'express';
import { signalCountRequestSchema } from './backtest.schema';
import { getSignalCount } from './backtest.service';
import { AuthenticatedRequest } from '../../types';

export async function signalCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const body    = signalCountRequestSchema.parse(req.body);

    const result = await getSignalCount(body, {
      sessionId: authReq.ctx.sessionId,
      requestId: authReq.ctx.requestId,
      userId:    authReq.user.id,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
