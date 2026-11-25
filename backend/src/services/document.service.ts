import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';
import { LegalCase } from '../models/LegalCase';
import { AppError } from '../utils/AppError';
import { looksLikePdf, safeFileName, sha256Hex } from '../utils/file';
import { Actor, getViewableCase, isOwner } from './case.service';
import { getStorage } from './storage.service';

/** bytes32 identifier used on-chain. Derived from the Mongo id; contains no personal data. */
export const documentKeyFor = (id: Types.ObjectId | string) => ethers.id(`legal-doc:${String(id)}`);

export interface UploadInput {
  file: { buffer: Buffer; originalname: string; mimetype: string };
  caseId: string;
  title?: string;
  documentId?: string;
  actor: Actor;
  isDemo?: boolean;
}

/** Loads a document the actor may view (visibility follows the parent case). */
export async function getViewableDocument(documentId: string, actor: Actor) {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw AppError.notFound('Document not found');
  await getViewableCase(String(doc.legalCase), actor);
  return doc;
}

export async function storeNewVersion(input: UploadInput) {
  const { file, actor } = input;
  if (!looksLikePdf(file.buffer)) throw AppError.badRequest('File content is not a valid PDF');

  const legalCase = await getViewableCase(input.caseId, actor);
  if (actor.role === 'FACULTY' && !isOwner(legalCase, actor)) {
    throw AppError.forbidden('You can only upload documents to cases you created');
  }
  if (legalCase.status === 'ARCHIVED') throw AppError.conflict('Cannot upload to an archived case');

  const sha256 = sha256Hex(file.buffer);
  let doc;
  let version: number;

  if (input.documentId) {
    doc = await DocumentModel.findById(input.documentId);
    if (!doc || String(doc.legalCase) !== String(legalCase._id)) throw AppError.notFound('Document not found for this case');
    const latest = await DocumentVersion.findOne({ document: doc._id, version: doc.currentVersion });
    if (latest?.sha256 === sha256) throw AppError.conflict('This file is identical to the current version');
    // Optimistic concurrency: only one concurrent uploader can claim the next number.
    const bumped = await DocumentModel.findOneAndUpdate(
      { _id: doc._id, currentVersion: doc.currentVersion },
      { $inc: { currentVersion: 1 } },
      { new: true },
    );
    if (!bumped) throw AppError.conflict('Another upload is in progress, please retry');
    doc = bumped;
    version = bumped.currentVersion;
  } else {
    const _id = new Types.ObjectId();
    doc = await DocumentModel.create({
      _id,
      legalCase: legalCase._id,
      title: input.title || legalCase.title,
      documentKey: documentKeyFor(_id),
      currentVersion: 1,
      isDemo: input.isDemo ?? false,
      createdBy: actor.id,
    });
    version = 1;
  }

  const storageKey = `${doc.id}/v${version}-${randomUUID()}.pdf`;
  try {
    await getStorage().save(storageKey, file.buffer);
    const docVersion = await DocumentVersion.create({
      document: doc._id,
      version,
      storageKey,
      originalName: file.originalname.slice(0, 255),
      safeName: safeFileName(file.originalname),
      mimeType: 'application/pdf',
      size: file.buffer.length,
      sha256,
      uploadedBy: actor.id,
    });
    return { document: doc, version: docVersion, legalCase };
  } catch (err) {
    // Roll back the metadata we just created so no version exists without its file.
    if (version === 1) await DocumentModel.deleteOne({ _id: doc._id });
    else await DocumentModel.updateOne({ _id: doc._id }, { $inc: { currentVersion: -1 } });
    throw err;
  }
}

export async function getVersionOrThrow(documentId: string, version?: number) {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw AppError.notFound('Document not found');
  const v = await DocumentVersion.findOne({ document: doc._id, version: version ?? doc.currentVersion });
  if (!v) throw AppError.notFound('Document version not found');
  return { doc, version: v };
}

export async function casesOwnedBy(userId: string) {
  return LegalCase.find({ createdBy: userId }).distinct('_id');
}
