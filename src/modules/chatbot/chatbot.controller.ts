import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendMessage, getSession, getMessages } from './chatbot.service';
import { AuthenticatedRequest } from '../../types';

const chatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000),
});

const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// POST /api/chat/respond
export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { message } = chatSchema.parse(req.body);

    const result = await sendMessage(message, authReq.user.id, {
      sessionId: authReq.ctx.sessionId,
      requestId: authReq.ctx.requestId,
      userId:    authReq.user.id,
    });

    res.json(result);
  } catch (err) { next(err); }
}

// GET /api/chat/session
export async function session(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const result  = await getSession(authReq.user.id);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

// GET /api/chat/messages
export async function messages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq         = req as AuthenticatedRequest;
    const { page, limit } = paginationSchema.parse(req.query);
    const result          = await getMessages(authReq.user.id, page, limit);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}