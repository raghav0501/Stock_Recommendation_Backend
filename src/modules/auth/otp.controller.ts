import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { requestOtpSchema, verifyOtpSchema } from './otp.schema';
import * as otpService from './otp.service';
import { sendSuccess } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

export async function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = requestOtpSchema.parse(req.body);
    const authReq   = req as AuthenticatedRequest;
    await otpService.requestOtp(email, authReq.ctx);
    // Always return the same response to prevent email enumeration
    sendSuccess(res, { message: 'If that email is registered, an OTP has been sent.' }, StatusCodes.OK);
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);
    const authReq        = req as AuthenticatedRequest;
    const result         = await otpService.verifyOtp(email, otp, authReq.ctx);
    sendSuccess(res, result, StatusCodes.OK);
  } catch (err) {
    next(err);
  }
}
