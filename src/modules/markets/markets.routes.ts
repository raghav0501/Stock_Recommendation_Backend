import { Router, Request, Response, NextFunction } from 'express';
import { getActiveMarkets } from './markets.service';
import { sendSuccess } from '../../utils/response';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getActiveMarkets((req as AuthenticatedRequest).ctx);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

const router = Router();
router.get('/', authenticate, list);

export default router;
