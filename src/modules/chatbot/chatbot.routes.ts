import { Router } from 'express';
import * as chatbotController from './chatbot.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();

router.use(authenticate, loadEntitlements);

router.post('/message', chatbotController.sendMessage);
router.get('/sessions', chatbotController.getSessions);
router.get('/sessions/:sessionId/messages', chatbotController.getSessionMessages);

export default router;
