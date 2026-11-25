import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { DocumentModel } from '../models/Document';
import { casesOwnedBy } from '../services/document.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/apiResponse';
import { buildMeta, parsePagination } from '../utils/pagination';

/** Admins see everything; faculty see their own actions and events on cases/documents they own. */
async function scopeFor(req: Request): Promise<Record<string, unknown>> {
  const user = req.user!;
  if (user.role === 'ADMIN') return {};
  const caseIds = await casesOwnedBy(user.id);
  const docIds = await DocumentModel.find({ legalCase: { $in: caseIds } }).distinct('_id');
  const resourceIds = [...caseIds, ...docIds].map(String);
  return { $or: [{ actor: user.id }, { resourceId: { $in: resourceIds } }] };
}

export async function listAuditLogs(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const q = req.query as Record<string, string | undefined>;
  const and: Record<string, unknown>[] = [await scopeFor(req)];
  if (q.action) and.push({ action: q.action });
  if (q.outcome) and.push({ outcome: q.outcome });
  if (q.actor) and.push({ actor: q.actor });
  if (q.resourceType) and.push({ resourceType: q.resourceType });
  if (q.resourceId) and.push({ resourceId: q.resourceId });
  if (q.from || q.to) {
    and.push({ createdAt: { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(q.to) } : {}) } });
  }
  const filter = { $and: and };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email role'),
    AuditLog.countDocuments(filter),
  ]);
  return ok(res, items, undefined, 200, buildMeta(page, limit, total));
}

export async function getAuditLog(req: Request, res: Response) {
  const entry = await AuditLog.findOne({ $and: [{ _id: req.params.id }, await scopeFor(req)] }).populate(
    'actor',
    'name email role',
  );
  if (!entry) throw AppError.notFound('Audit log entry not found');
  return ok(res, entry);
}

export async function auditActions(_req: Request, res: Response) {
  return ok(res, (await AuditLog.distinct('action')).sort());
}
