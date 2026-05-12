import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { signalCountRequestSchema } from './backtest.schema';
import { getSignalCount } from './backtest.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('backtest');

export async function signalCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    log.info('Received signal count request', {
      requestId: (req as AuthenticatedRequest).ctx.requestId,
      userId:    (req as AuthenticatedRequest).user.id,
    });
    const authReq = req as AuthenticatedRequest;
    const body    = signalCountRequestSchema.parse(req.body);

    const data = await getSignalCount(body, {
      sessionId: authReq.ctx.sessionId,
      requestId: authReq.ctx.requestId,
      userId:    authReq.user.id,
    });

    sendSuccess(res, data, StatusCodes.OK);
  } catch (err) {
    log.error('Error in signal count request', {
      requestId: (req as AuthenticatedRequest).ctx.requestId,
      userId: (req as AuthenticatedRequest).user.id,
    });
    next(err);
  }
}
