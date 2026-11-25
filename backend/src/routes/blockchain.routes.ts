import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/blockchain.controller';
import { authenticate, authorize, validateObjectId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

export const blockchainRouter = Router();
blockchainRouter.use(authenticate);

const registerSchema = z
  .object({ documentId: z.string().regex(/^[a-f0-9]{24}$/i), version: z.coerce.number().int().min(1).optional() })
  .strict();

blockchainRouter.post('/register', authorize('FACULTY', 'ADMIN'), validate(registerSchema), asyncHandler(ctrl.registerDocument));
blockchainRouter.get('/status', authorize('ADMIN', 'FACULTY'), asyncHandler(ctrl.chainStatus));
blockchainRouter.get('/records', authorize('ADMIN'), asyncHandler(ctrl.listRecords));
blockchainRouter.get('/records/:documentId', validateObjectId('documentId'), asyncHandler(ctrl.documentRecords));
