import { Request, Response } from 'express';
import { BlockchainRecord } from '../models/BlockchainRecord';
import { DocumentModel } from '../models/Document';
import { logAudit } from '../services/audit.service';
import { getBlockchain } from '../services/blockchain.service';
import { isOwner } from '../services/case.service';
import { casesOwnedBy, getViewableDocument } from '../services/document.service';
import { verifyDocumentVersion } from '../services/verification.service';
import { AuditLog } from '../models/AuditLog';
import { LegalCase } from '../models/LegalCase';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/apiResponse';
import { buildMeta, parsePagination } from '../utils/pagination';

const recordView = (r: InstanceType<typeof BlockchainRecord>) => r.toJSON();

/** Runs registration for a document and writes the audit trail. Shared by upload and the retry endpoint. */
export async function registerAndAudit(req: Request, documentId: string, onlyVersion?: number) {
  const { records, newlyConfirmed, failed } = await getBlockchain().registerDocumentVersions(
    documentId,
    req.user?.id,
    onlyVersion,
  );
  for (const r of records) {
    if (newlyConfirmed.includes(r.version)) {
      await logAudit(req, {
        action: 'BLOCKCHAIN_REGISTERED', resourceType: 'document', resourceId: documentId,
        metadata: { version: r.version, txHash: r.txHash, blockNumber: r.blockNumber },
      });
    } else if (failed.includes(r.version)) {
      await logAudit(req, {
        action: 'BLOCKCHAIN_REGISTRATION_FAILED', outcome: 'FAILURE', resourceType: 'document',
        resourceId: documentId, metadata: { version: r.version, error: r.error },
      });
    }
  }
  return records;
}

export async function registerDocument(req: Request, res: Response) {
  const { documentId, version } = req.body as { documentId: string; version?: number };
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw AppError.notFound('Document not found');
  const legalCase = await LegalCase.findById(doc.legalCase);
  if (!legalCase) throw AppError.notFound('Case not found');
  if (req.user!.role === 'FACULTY' && !isOwner(legalCase, req.user!)) {
    await logAudit(req, { action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED', resourceType: 'document', resourceId: documentId });
    throw AppError.forbidden('You can only register documents of cases you created');
  }
  const results = await registerAndAudit(req, documentId, version);
  return ok(res, results.map(recordView), 'Registration processed');
}

export async function documentRecords(req: Request, res: Response) {
  const doc = await getViewableDocument(req.params.documentId, req.user!);
  const records = await BlockchainRecord.find({ document: doc._id }).sort({ version: 1 });
  const svc = getBlockchain();
  const refreshed = await Promise.all(records.map((r) => (r.status === 'SUBMITTED' ? svc.reconcile(r) : r)));
  return ok(res, refreshed.map(recordView));
}

export async function listRecords(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query as { status?: string };
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    BlockchainRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate({ path: 'document', select: 'title legalCase', populate: { path: 'legalCase', select: 'title caseNumber' } }),
    BlockchainRecord.countDocuments(filter),
  ]);
  return ok(res, items.map(recordView), undefined, 200, buildMeta(page, limit, total));
}

async function verifyAndAudit(req: Request, res: Response, copy?: Buffer) {
  const { version } = req.query as { version?: number };
  await getViewableDocument(req.params.documentId, req.user!);
  const result = await verifyDocumentVersion(req.params.documentId, version, copy);
  await logAudit(req, {
    action: 'DOCUMENT_VERIFIED', resourceType: 'document', resourceId: req.params.documentId,
    outcome: result.status === 'VERIFIED' ? 'SUCCESS' : 'FAILURE',
    metadata: { version: result.version, status: result.status, source: result.source, currentHash: result.currentHash },
  });
  return ok(res, result);
}

export const verifyStored = (req: Request, res: Response) => verifyAndAudit(req, res);

export async function verifyUploadedCopy(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('A PDF file is required (field name: file)');
  return verifyAndAudit(req, res, req.file.buffer);
}

/** Verification history, scoped by role: students see their own, faculty their documents, admin everything. */
export async function verificationHistory(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, documentId } = req.query as { status?: string; documentId?: string };
  const user = req.user!;
  const filter: Record<string, unknown> = { action: 'DOCUMENT_VERIFIED' };
  if (status) filter['metadata.status'] = status;
  if (documentId) filter.resourceId = documentId;
  if (user.role === 'STUDENT') filter.actor = user.id;
  if (user.role === 'FACULTY') {
    const caseIds = await casesOwnedBy(user.id);
    const docIds = (await DocumentModel.find({ legalCase: { $in: caseIds } }).distinct('_id')).map(String);
    filter.$or = [{ actor: user.id }, { resourceId: { $in: docIds } }];
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name role'),
    AuditLog.countDocuments(filter),
  ]);
  return ok(res, items, undefined, 200, buildMeta(page, limit, total));
}

export async function chainStatus(_req: Request, res: Response) {
  return ok(res, await getBlockchain().status());
}
