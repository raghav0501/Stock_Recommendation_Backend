import { Request, Response, NextFunction } from 'express';
import * as preferencesService from './preferences.service';
import { updatePreferencesSchema } from './preferences.schema';
import { sendSuccess } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

export async function getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const result  = await preferencesService.getPreferences(authReq.user.id, authReq.ctx);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { preferredIndicators, theme } = updatePreferencesSchema.parse(req.body);
    const result = await preferencesService.updatePreferences(
      authReq.user.id,
      preferredIndicators,
      theme,
      authReq.user.entitledIndicatorIds,
      authReq.ctx,
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
}
