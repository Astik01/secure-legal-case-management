import { Router } from 'express';
import * as ctrl from '../controllers/user.controller';
import { authenticate, authorize, validateObjectId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { adminCreateUserSchema } from '../validators/auth.validator';
import { listUsersQuery, roleSchema, statusSchema, updateUserSchema } from '../validators/user.validator';

export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get('/', authorize('ADMIN'), validate(listUsersQuery, 'query'), asyncHandler(ctrl.listUsers));
userRouter.post('/', authorize('ADMIN'), validate(adminCreateUserSchema), asyncHandler(ctrl.createUser));
userRouter.get('/:id', validateObjectId('id'), asyncHandler(ctrl.getUser));
userRouter.put('/:id', validateObjectId('id'), validate(updateUserSchema), asyncHandler(ctrl.updateUser));
userRouter.patch(
  '/:id/role',
  authorize('ADMIN'),
  validateObjectId('id'),
  validate(roleSchema),
  asyncHandler(ctrl.changeRole),
);
userRouter.patch(
  '/:id/status',
  authorize('ADMIN'),
  validateObjectId('id'),
  validate(statusSchema),
  asyncHandler(ctrl.changeStatus),
);
