import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Public routes
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
