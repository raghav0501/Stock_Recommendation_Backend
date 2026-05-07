import { Router } from 'express';
import { signalCount } from './backtest.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();

router.use(authenticate, loadEntitlements);

// POST /api/backtest/signalcount
router.post('/signalcount', signalCount);

export default router;
