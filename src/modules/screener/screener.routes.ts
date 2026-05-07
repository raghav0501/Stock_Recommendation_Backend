import { Router } from 'express';
import { screen, signals } from './screener.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();

router.use(authenticate, loadEntitlements);

// POST /api/screen  — matches Python path the frontend expects
router.post('/', screen);

// GET /api/signals  — mounted separately in app.ts at /api/signals
router.get('/signals', signals);

export default router;