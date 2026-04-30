import { Request, Response, NextFunction } from 'express';
import * as chatbotService from './chatbot.service';
import { chatMessageSchema, getSessionsSchema, getMessagesSchema } from './chatbot.schema';
import { sendSuccess } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const body    = chatMessageSchema.parse(req.body);

    const result = await chatbotService.sendMessage(
      authReq.user.id,
      body.query,
      body.sessionId,
      body.context,
      {
        sessionId: authReq.ctx.sessionId,
        requestId: authReq.ctx.requestId,
        userId:    authReq.user.id,
      },
    );

    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page, limit } = getSessionsSchema.parse(req.query);

    const result = await chatbotService.getSessions(
      authReq.user.id,
      page,
      limit,
      { sessionId: authReq.ctx.sessionId, requestId: authReq.ctx.requestId, userId: authReq.user.id },
    );

    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function getSessionMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq         = req as AuthenticatedRequest;
    const { sessionId }   = req.params;
    const { page, limit } = getMessagesSchema.parse(req.query);

    const result = await chatbotService.getSessionMessages(
      authReq.user.id,
      sessionId,
      page,
      limit,
      { sessionId: authReq.ctx.sessionId, requestId: authReq.ctx.requestId, userId: authReq.user.id },
    );

    sendSuccess(res, result);
  } catch (err) { next(err); }
}
