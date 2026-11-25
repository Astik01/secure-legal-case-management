import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/blockchain.controller';
import { authenticate, authorize, validateObjectId } from '../middleware/auth';
import { uploadPdf } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { VERIFICATION_STATUSES } from '../utils/constants';

export const blockchainRouter = Router();
blockchainRouter.use(authenticate);

const registerSchema = z
  .object({ documentId: z.string().regex(/^[a-f0-9]{24}$/i), version: z.coerce.number().int().min(1).optional() })
  .strict();
const versionQuery = z.object({ version: z.coerce.number().int().min(1).optional() });
const historyQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(VERIFICATION_STATUSES).optional(),
  documentId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});

blockchainRouter.post('/register', authorize('FACULTY', 'ADMIN'), validate(registerSchema), asyncHandler(ctrl.registerDocument));
blockchainRouter.get('/status', authorize('ADMIN', 'FACULTY'), asyncHandler(ctrl.chainStatus));
blockchainRouter.get('/records', authorize('ADMIN'), asyncHandler(ctrl.listRecords));
blockchainRouter.get('/records/:documentId', validateObjectId('documentId'), asyncHandler(ctrl.documentRecords));
blockchainRouter.get('/verifications', validate(historyQuery, 'query'), asyncHandler(ctrl.verificationHistory));
blockchainRouter.get(
  '/verify/:documentId',
  validateObjectId('documentId'),
  validate(versionQuery, 'query'),
  asyncHandler(ctrl.verifyStored),
);
// Verify a copy the user holds (e.g. a downloaded PDF) against the registered hash.
blockchainRouter.post(
  '/verify/:documentId/file',
  validateObjectId('documentId'),
  validate(versionQuery, 'query'),
  uploadPdf,
  asyncHandler(ctrl.verifyUploadedCopy),
);
