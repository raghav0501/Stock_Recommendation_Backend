import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';
import * as authService from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = loginSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;
    const result = await authService.loginUser(body, authReq.ctx);
    sendSuccess(res, result, StatusCodes.OK);
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;
    const result  = await authService.refreshUserToken(refreshToken, authReq.ctx);
    sendSuccess(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    await authService.logoutUser(authReq.user.id, authReq.ctx);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const authReq   = req as AuthenticatedRequest;
    await authService.requestPasswordReset(email, authReq.ctx);
    // Always 200 to prevent email enumeration
    sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;
    await authService.resetPassword(token, password, authReq.ctx);
    sendSuccess(res, { message: 'Password reset successfully.' });
  } catch (err) {
    next(err);
  }
}

export function getMe(req: Request, res: Response): void {
  const authReq = req as AuthenticatedRequest;
  sendSuccess(res, {
    id:                    authReq.user.id,
    role:                  authReq.user.role,
    entitledIndicatorIds:  authReq.user.entitledIndicatorIds,
  });
}
