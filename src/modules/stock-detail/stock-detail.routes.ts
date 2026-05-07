/**
 * Stock Detail Routes
 *
 * POST /api/stock-details                    ← matches Python path
 * POST /api/stock_snapshot/:exchange/:symbol ← matches Python path
 * GET  /api/news/stock/combined/:symbol      ← matches Python path
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, loadEntitlements } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';
import {
  getStockDetails,
  getStockSnapshot,
  getStockNews,
} from './stock-detail.service';

// Re-export for import convenience
export { getStockDetails, getStockSnapshot, getStockNews };

const stockDetailsSchema = z.object({
  exchange:   z.string().min(1),
  symbol:     z.string().min(1),
  indicators: z.array(z.string()).optional().default([]),
});

function getCtx(req: AuthenticatedRequest) {
  return {
    sessionId: req.ctx.sessionId,
    requestId: req.ctx.requestId,
    userId:    req.user.id,
  };
}

// ── Controllers ────────────────────────────────────────────────────────────

async function stockDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const body    = stockDetailsSchema.parse(req.body);
    const result  = await getStockDetails(body.exchange, body.symbol, body.indicators, getCtx(authReq));
    res.json(result);
  } catch (err) { next(err); }
}

async function stockSnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { exchange, symbol } = req.params;
    const result = await getStockSnapshot(exchange, symbol, getCtx(authReq));
    res.json(result);
  } catch (err) { next(err); }
}

async function stockNews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { symbol } = req.params;
    const result = await getStockNews(symbol, getCtx(authReq));
    res.json(result);
  } catch (err) { next(err); }
}

// ── Router ─────────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate, loadEntitlements);

router.post('/', stockDetails);
router.post('/stock_snapshot/:exchange/:symbol', stockSnapshot);
router.get('/news/stock/combined/:symbol', stockNews);

export default router;