import { Router } from 'express';
import * as screenerController from './screener.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();

router.post('/', authenticate, loadEntitlements, screenerController.screen);

export default router;
