import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getStockDetail } from './stock-detail.service';
import { authenticate, loadEntitlements } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const querySchema = z.object({
  range: z.enum(['1W', '1M', '3M', '1Y']).default('1M'),
});

async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const symbol  = req.params.symbol?.toUpperCase();
    const { range } = querySchema.parse(req.query);

    if (!symbol) { res.status(400).json({ status: 'error', code: 'MISSING_SYMBOL', message: 'Symbol is required' }); return; }

    const result = await getStockDetail(symbol, range, {
      sessionId:            authReq.ctx.sessionId,
      requestId:            authReq.ctx.requestId,
      userId:               authReq.user.id,
      entitledIndicatorIds: authReq.user.entitledIndicatorIds,
    });

    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

const router = Router();
router.get('/:symbol', authenticate, loadEntitlements, detail);

export default router;
