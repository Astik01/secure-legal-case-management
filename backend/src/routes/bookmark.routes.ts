import { Router } from 'express';
import * as ctrl from '../controllers/bookmark.controller';
import { authenticate, validateObjectId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { bookmarkSchema } from '../validators/case.validator';

export const bookmarkRouter = Router();
bookmarkRouter.use(authenticate);

bookmarkRouter.post('/', validate(bookmarkSchema), asyncHandler(ctrl.addBookmark));
bookmarkRouter.get('/', asyncHandler(ctrl.listBookmarks));
bookmarkRouter.delete('/:id', validateObjectId('id'), asyncHandler(ctrl.removeBookmark));
