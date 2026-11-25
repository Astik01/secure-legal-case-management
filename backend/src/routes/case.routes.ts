import { Router } from 'express';
import * as ctrl from '../controllers/case.controller';
import { authenticate, authorize, validateObjectId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { approveSchema, createCaseSchema, listCasesQuery, updateCaseSchema } from '../validators/case.validator';

export const caseRouter = Router();
caseRouter.use(authenticate);

caseRouter.get('/', validate(listCasesQuery, 'query'), asyncHandler(ctrl.listCases));
caseRouter.get('/meta/filters', asyncHandler(ctrl.filterOptions));
caseRouter.post('/', authorize('FACULTY', 'ADMIN'), validate(createCaseSchema), asyncHandler(ctrl.createCase));
caseRouter.get('/:id', validateObjectId('id'), asyncHandler(ctrl.getCase));
caseRouter.put(
  '/:id',
  authorize('FACULTY', 'ADMIN'),
  validateObjectId('id'),
  validate(updateCaseSchema),
  asyncHandler(ctrl.updateCase),
);
caseRouter.patch('/:id/submit', authorize('FACULTY', 'ADMIN'), validateObjectId('id'), asyncHandler(ctrl.submitCase));
caseRouter.patch(
  '/:id/approve',
  authorize('ADMIN'),
  validateObjectId('id'),
  validate(approveSchema),
  asyncHandler(ctrl.approveCase),
);
caseRouter.patch('/:id/archive', authorize('ADMIN'), validateObjectId('id'), asyncHandler(ctrl.archiveCase));
caseRouter.delete('/:id', authorize('ADMIN'), validateObjectId('id'), asyncHandler(ctrl.deleteCase));
