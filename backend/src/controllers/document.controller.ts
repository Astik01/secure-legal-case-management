import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';
import { logAudit } from '../services/audit.service';
import { getViewableCase } from '../services/case.service';
import { getViewableDocument, getVersionOrThrow, storeNewVersion } from '../services/document.service';
import { getStorage } from '../services/storage.service';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/apiResponse';

const versionView = (v: InstanceType<typeof DocumentVersion>) => ({
  _id: v.id,
  version: v.version,
  originalName: v.originalName,
  safeName: v.safeName,
  size: v.size,
  sha256: v.sha256,
  uploadedBy: v.uploadedBy,
  createdAt: (v as unknown as { createdAt: Date }).createdAt,
});

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('A PDF file is required (field name: file)');
  const { caseId, title, documentId } = req.body;
  const user = req.user!;
  let result;
  try {
    result = await storeNewVersion({ file: req.file, caseId, title, documentId, actor: user });
  } catch (err) {
    await logAudit(req, {
      action: 'DOCUMENT_UPLOAD_FAILED', outcome: err instanceof AppError && err.statusCode === 403 ? 'DENIED' : 'FAILURE',
      resourceType: 'case', resourceId: caseId, metadata: { reason: err instanceof Error ? err.message : 'unknown' },
    });
    throw err;
  }
  const { document, version } = result;
  await logAudit(req, {
    action: version.version === 1 ? 'DOCUMENT_UPLOADED' : 'DOCUMENT_VERSION_CREATED',
    resourceType: 'document', resourceId: document.id,
    metadata: { caseId, version: version.version, sha256: version.sha256, size: version.size },
  });
  return created(res, { document, version: versionView(version) }, 'Document uploaded');
}

export async function listDocuments(req: Request, res: Response) {
  const { caseId } = req.query as { caseId: string };
  await getViewableCase(caseId, req.user!);
  const docs = await DocumentModel.find({ legalCase: caseId }).sort({ createdAt: 1 });
  const out = await Promise.all(
    docs.map(async (d) => {
      const current = await DocumentVersion.findOne({ document: d._id, version: d.currentVersion });
      return { ...d.toJSON(), current: current ? versionView(current) : null };
    }),
  );
  return ok(res, out);
}

export async function getDocument(req: Request, res: Response) {
  const doc = await getViewableDocument(req.params.id, req.user!);
  const versions = await DocumentVersion.find({ document: doc._id }).sort({ version: 1 });
  return ok(res, { ...doc.toJSON(), versions: versions.map(versionView) });
}

export async function listVersions(req: Request, res: Response) {
  const doc = await getViewableDocument(req.params.id, req.user!);
  const versions = await DocumentVersion.find({ document: doc._id }).sort({ version: 1 }).populate('uploadedBy', 'name');
  return ok(res, versions.map((v) => ({ ...versionView(v), uploadedBy: v.uploadedBy })));
}

export async function downloadDocument(req: Request, res: Response) {
  const { version: wanted, inline } = req.query as { version?: number; inline?: string };
  await getViewableDocument(req.params.id, req.user!);
  const { doc, version } = await getVersionOrThrow(req.params.id, wanted);
  const storage = getStorage();
  if (!(await storage.exists(version.storageKey))) throw AppError.notFound('Stored file is missing');

  await logAudit(req, {
    action: 'DOCUMENT_DOWNLOADED', resourceType: 'document', resourceId: doc.id,
    metadata: { version: version.version, inline: inline === 'true' },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(version.size));
  res.setHeader(
    'Content-Disposition',
    `${inline === 'true' ? 'inline' : 'attachment'}; filename="${version.safeName}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  storage.stream(version.storageKey).on('error', () => res.destroy()).pipe(res);
}
