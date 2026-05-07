import { Router } from 'express';
import * as authController from './auth.controller';
import * as otpController  from './otp.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// ── Password-based auth ────────────────────────────────────────────────────
router.post('/login',           authController.login);
router.post('/refresh',         authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);

// ── OTP-based auth ─────────────────────────────────────────────────────────
// POST /api/auth/otp/request  – generate & email a 6-digit OTP
// POST /api/auth/otp/verify   – validate OTP and receive tokens
router.post('/otp/request', otpController.requestOtp);
router.post('/otp/verify',  otpController.verifyOtp);

// ── Protected routes ───────────────────────────────────────────────────────
router.post('/logout', authenticate, authController.logout);
router.get('/me',      authenticate, authController.getMe);

export default router;
