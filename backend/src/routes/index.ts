import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../utils/apiResponse';

import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { caseRouter } from './case.routes';
import { bookmarkRouter } from './bookmark.routes';
import { documentRouter } from './document.routes';
import { blockchainRouter } from './blockchain.routes';
import { analyticsRouter, auditRouter } from './audit.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/cases', caseRouter);
apiRouter.use('/bookmarks', bookmarkRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/blockchain', blockchainRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/', analyticsRouter);

apiRouter.get('/health', (_req, res) =>
  ok(res, {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  }),
);
