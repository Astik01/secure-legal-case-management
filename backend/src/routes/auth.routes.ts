import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import * as ctrl from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

// Brute-force protection for credential endpoints.
const authLimiter = env.rateLimitEnabled
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, message: 'Too many attempts, try again later', error: { code: 'RATE_LIMITED' } },
    })
  : (_req: unknown, _res: unknown, next: () => void) => next();

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(ctrl.register));
authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(ctrl.login));
authRouter.post('/logout', authenticate, asyncHandler(ctrl.logout));
authRouter.get('/me', authenticate, asyncHandler(ctrl.me));
