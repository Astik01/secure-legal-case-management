import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../utils/apiResponse';

import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { caseRouter } from './case.routes';
import { bookmarkRouter } from './bookmark.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/cases', caseRouter);
apiRouter.use('/bookmarks', bookmarkRouter);

apiRouter.get('/health', (_req, res) =>
  ok(res, {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  }),
);
