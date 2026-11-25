import { Request, Response } from 'express';
import { Bookmark } from '../models/Bookmark';
import { LegalCase } from '../models/LegalCase';
import { logAudit } from '../services/audit.service';
import { getViewableCase, isOwner, visibilityFilter } from '../services/case.service';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/apiResponse';
import { buildMeta, escapeRegex, parsePagination } from '../utils/pagination';

const rx = (s: string) => new RegExp(escapeRegex(s), 'i');
const SORTS: Record<string, Record<string, 1 | -1>> = {
  recent: { createdAt: -1 },
  year_desc: { year: -1, title: 1 },
  year_asc: { year: 1, title: 1 },
  title: { title: 1 },
};

export async function listCases(req: Request, res: Response) {
  const user = req.user!;
  const { page, limit, skip } = parsePagination(req.query);
  const q = req.query as Record<string, string | number | undefined>;
  const and: Record<string, unknown>[] = [visibilityFilter(user)];

  if (q.q) {
    const r = rx(String(q.q));
    and.push({ $or: [{ title: r }, { caseNumber: r }, { petitioner: r }, { respondent: r }, { summary: r }, { tags: r }, { court: r }] });
  }
  if (q.title) and.push({ title: rx(String(q.title)) });
  if (q.caseNumber) and.push({ caseNumber: rx(String(q.caseNumber)) });
  if (q.court) and.push({ court: rx(String(q.court)) });
  if (q.year) and.push({ year: q.year });
  if (q.category) and.push({ category: q.category });
  // Status filter is only meaningful to staff; students are already restricted to PUBLISHED.
  if (q.status) and.push({ status: q.status });
  if (q.mine === 'true') and.push({ createdBy: user.id });

  const filter = { $and: and };
  const [items, total] = await Promise.all([
    LegalCase.find(filter)
      .sort(SORTS[String(q.sort ?? 'recent')])
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name'),
    LegalCase.countDocuments(filter),
  ]);
  return ok(res, items, undefined, 200, buildMeta(page, limit, total));
}

export async function filterOptions(req: Request, res: Response) {
  const base = visibilityFilter(req.user!);
  const [courts, years, categories] = await Promise.all([
    LegalCase.distinct('court', base),
    LegalCase.distinct('year', base),
    LegalCase.distinct('category', base),
  ]);
  return ok(res, {
    courts: courts.sort(),
    years: years.sort((a: number, b: number) => b - a),
    categories: categories.sort(),
  });
}

export async function getCase(req: Request, res: Response) {
  const legalCase = await getViewableCase(req.params.id, req.user!);
  await legalCase.populate([
    { path: 'createdBy', select: 'name' },
    { path: 'reviewedBy', select: 'name' },
  ]);
  const bookmark = await Bookmark.findOne({ user: req.user!.id, legalCase: legalCase._id });
  return ok(res, { ...legalCase.toJSON(), bookmarkId: bookmark?.id ?? null });
}

export async function createCase(req: Request, res: Response) {
  const legalCase = await LegalCase.create({ ...req.body, status: 'DRAFT', createdBy: req.user!.id });
  await logAudit(req, {
    action: 'CASE_CREATED', resourceType: 'case', resourceId: legalCase.id,
    metadata: { caseNumber: legalCase.caseNumber },
  });
  return created(res, legalCase, 'Case created');
}

export async function updateCase(req: Request, res: Response) {
  const user = req.user!;
  const legalCase = await getViewableCase(req.params.id, user);
  if (user.role === 'FACULTY') {
    if (!isOwner(legalCase, user)) {
      await logAudit(req, { action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED', resourceType: 'case', resourceId: legalCase.id });
      throw AppError.forbidden('You can only edit cases you created');
    }
    if (!['DRAFT', 'REJECTED'].includes(legalCase.status)) {
      throw AppError.conflict(`A ${legalCase.status.toLowerCase()} case cannot be edited by faculty`);
    }
  }
  Object.assign(legalCase, req.body);
  if (legalCase.status === 'REJECTED' && user.role === 'FACULTY') legalCase.status = 'DRAFT';
  await legalCase.save();
  await logAudit(req, {
    action: 'CASE_UPDATED', resourceType: 'case', resourceId: legalCase.id, metadata: { fields: Object.keys(req.body) },
  });
  return ok(res, legalCase, 'Case updated');
}

export async function submitCase(req: Request, res: Response) {
  const user = req.user!;
  const legalCase = await getViewableCase(req.params.id, user);
  if (user.role === 'FACULTY' && !isOwner(legalCase, user)) {
    await logAudit(req, { action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED', resourceType: 'case', resourceId: legalCase.id });
    throw AppError.forbidden('You can only submit cases you created');
  }
  if (!['DRAFT', 'REJECTED'].includes(legalCase.status)) {
    throw AppError.conflict(`Only draft or rejected cases can be submitted (current: ${legalCase.status})`);
  }
  legalCase.status = 'PENDING';
  legalCase.submittedAt = new Date();
  legalCase.reviewNote = undefined;
  await legalCase.save();
  await logAudit(req, { action: 'CASE_SUBMITTED', resourceType: 'case', resourceId: legalCase.id });
  return ok(res, legalCase, 'Case submitted for approval');
}

export async function approveCase(req: Request, res: Response) {
  const { decision, note } = req.body as { decision: 'APPROVE' | 'REJECT'; note?: string };
  const legalCase = await getViewableCase(req.params.id, req.user!);
  if (legalCase.status !== 'PENDING') {
    throw AppError.conflict(`Only pending cases can be reviewed (current: ${legalCase.status})`);
  }
  legalCase.status = decision === 'APPROVE' ? 'PUBLISHED' : 'REJECTED';
  legalCase.reviewedBy = req.user!.id as never;
  legalCase.reviewedAt = new Date();
  legalCase.reviewNote = note;
  if (decision === 'APPROVE') legalCase.publishedAt = new Date();
  await legalCase.save();
  await logAudit(req, {
    action: decision === 'APPROVE' ? 'CASE_APPROVED' : 'CASE_REJECTED',
    resourceType: 'case', resourceId: legalCase.id, metadata: { note },
  });
  return ok(res, legalCase, decision === 'APPROVE' ? 'Case approved and published' : 'Case rejected');
}

export async function archiveCase(req: Request, res: Response) {
  const legalCase = await getViewableCase(req.params.id, req.user!);
  if (legalCase.status === 'ARCHIVED') throw AppError.conflict('Case is already archived');
  legalCase.status = 'ARCHIVED';
  await legalCase.save();
  await logAudit(req, { action: 'CASE_ARCHIVED', resourceType: 'case', resourceId: legalCase.id });
  return ok(res, legalCase, 'Case archived');
}

export async function deleteCase(req: Request, res: Response) {
  const legalCase = await getViewableCase(req.params.id, req.user!);
  await Bookmark.deleteMany({ legalCase: legalCase._id });
  await legalCase.deleteOne();
  await logAudit(req, {
    action: 'CASE_DELETED', resourceType: 'case', resourceId: legalCase.id,
    metadata: { caseNumber: legalCase.caseNumber, title: legalCase.title },
  });
  return ok(res, null, 'Case deleted');
}
