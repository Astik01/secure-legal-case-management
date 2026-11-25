import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../utils/apiResponse';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) =>
  ok(res, {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  }),
);
