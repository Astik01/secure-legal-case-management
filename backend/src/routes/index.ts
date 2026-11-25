import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../utils/apiResponse';

import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);

apiRouter.get('/health', (_req, res) =>
  ok(res, {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  }),
);
