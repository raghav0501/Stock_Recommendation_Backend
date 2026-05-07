/**
 * Chatbot Routes
 *
 * POST /api/chat/respond          <- send message, get Python response
 * GET  /api/chat/session          <- get this user's single session metadata
 * GET  /api/chat/messages         <- get all messages for this user (paginated)
 */
import { Router } from 'express';
import { chat, session, messages } from './chatbot.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();
router.use(authenticate, loadEntitlements);

router.post('/respond', chat);
router.get('/session',  session);
router.get('/messages', messages);

export default router;