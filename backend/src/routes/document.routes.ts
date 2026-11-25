import { Router } from 'express';
import * as ctrl from '../controllers/document.controller';
import { authenticate, authorize, validateObjectId } from '../middleware/auth';
import { uploadPdf } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { listDocumentsQuery, uploadBodySchema, versionQuery } from '../validators/document.validator';

export const documentRouter = Router();
documentRouter.use(authenticate);

documentRouter.post(
  '/upload',
  authorize('FACULTY', 'ADMIN'),
  uploadPdf,
  validate(uploadBodySchema),
  asyncHandler(ctrl.uploadDocument),
);
documentRouter.get('/', validate(listDocumentsQuery, 'query'), asyncHandler(ctrl.listDocuments));
documentRouter.get('/:id', validateObjectId('id'), asyncHandler(ctrl.getDocument));
documentRouter.get('/:id/versions', validateObjectId('id'), asyncHandler(ctrl.listVersions));
documentRouter.get(
  '/:id/download',
  validateObjectId('id'),
  validate(versionQuery, 'query'),
  asyncHandler(ctrl.downloadDocument),
);
