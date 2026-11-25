import { Request, Response } from 'express';
import { Bookmark } from '../models/Bookmark';
import { LegalCase } from '../models/LegalCase';
import { getViewableCase, visibilityFilter } from '../services/case.service';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/apiResponse';
import { buildMeta, parsePagination } from '../utils/pagination';

export async function addBookmark(req: Request, res: Response) {
  const { caseId, note } = req.body;
  const legalCase = await getViewableCase(caseId, req.user!);
  if (await Bookmark.exists({ user: req.user!.id, legalCase: legalCase._id })) {
    throw AppError.conflict('Case is already bookmarked');
  }
  const bookmark = await Bookmark.create({ user: req.user!.id, legalCase: legalCase._id, note });
  return created(res, bookmark, 'Bookmark added');
}

export async function listBookmarks(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  // Only bookmarks whose case is still visible to the user are returned.
  const visibleIds = await LegalCase.find(visibilityFilter(req.user!)).distinct('_id');
  const filter = { user: req.user!.id, legalCase: { $in: visibleIds } };
  const [items, total] = await Promise.all([
    Bookmark.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('legalCase'),
    Bookmark.countDocuments(filter),
  ]);
  return ok(res, items, undefined, 200, buildMeta(page, limit, total));
}

export async function removeBookmark(req: Request, res: Response) {
  // Scoped to the owner, so another user's bookmark id yields 404.
  const removed = await Bookmark.findOneAndDelete({ _id: req.params.id, user: req.user!.id });
  if (!removed) throw AppError.notFound('Bookmark not found');
  return ok(res, null, 'Bookmark removed');
}
