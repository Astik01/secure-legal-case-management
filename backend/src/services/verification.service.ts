import { timingSafeEqual } from 'crypto';
import { BlockchainRecord } from '../models/BlockchainRecord';
import { DocumentModel } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';
import { VerificationStatus } from '../utils/constants';
import { AppError } from '../utils/AppError';
import { sha256Hex } from '../utils/file';
import { getBlockchain } from './blockchain.service';
import { getStorage } from './storage.service';

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  documentId: string;
  documentKey: string;
  version: number;
  source: 'STORED_FILE' | 'UPLOADED_COPY';
  originalHash: string | null; // hash read from the blockchain (authoritative)
  currentHash: string | null; // hash computed now from the file bytes
  databaseHash: string; // hash stored in MongoDB at upload time (informational only)
  registeredAt: string | null;
  txHash?: string | null;
  blockNumber?: number | null;
  registrar?: string | null;
  contractAddress?: string | null;
  chainId?: number | null;
  verifiedAt: string;
}

const hex = (h: string) => h.replace(/^0x/, '').toLowerCase();

function equalHashes(a: string, b: string): boolean {
  const x = Buffer.from(hex(a), 'hex');
  const y = Buffer.from(hex(b), 'hex');
  return x.length === 32 && x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verifies one version of a document against the blockchain.
 * The result never depends on the HTTP layer succeeding: the registered hash is read from the contract
 * and compared byte-for-byte with a freshly computed SHA-256 of the file.
 * If `copy` is given it is hashed instead of the stored file.
 */
export async function verifyDocumentVersion(
  documentId: string,
  versionNumber: number | undefined,
  copy?: Buffer,
): Promise<VerificationResult> {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw AppError.notFound('Document not found');
  const version = await DocumentVersion.findOne({ document: doc._id, version: versionNumber ?? doc.currentVersion });
  if (!version) throw AppError.notFound('Document version not found');

  const base = {
    documentId: doc.id,
    documentKey: doc.documentKey,
    version: version.version,
    source: copy ? ('UPLOADED_COPY' as const) : ('STORED_FILE' as const),
    databaseHash: version.sha256,
    verifiedAt: new Date().toISOString(),
    originalHash: null as string | null,
    currentHash: null as string | null,
    registeredAt: null as string | null,
  };

  // 1. Obtain the bytes to check and hash them now.
  let bytes: Buffer;
  try {
    bytes = copy ?? (await getStorage().read(version.storageKey));
  } catch {
    return { ...base, status: 'VERIFICATION_ERROR', message: 'The stored file could not be read, so its hash cannot be computed.' };
  }
  const currentHash = `0x${sha256Hex(bytes)}`;

  // 2. Read the registered hash from the blockchain.
  let onChain;
  try {
    onChain = await getBlockchain().readVersion(doc.documentKey, version.version);
  } catch (err) {
    return {
      ...base, currentHash, status: 'VERIFICATION_ERROR',
      message: `Blockchain verification could not be completed: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}`,
    };
  }
  if (!onChain.registered || !onChain.record) {
    return { ...base, currentHash, status: 'NOT_REGISTERED', message: 'No blockchain registration exists for this document version.' };
  }

  // 3. Compare cryptographically.
  const rec = await BlockchainRecord.findOne({ document: doc._id, version: version.version });
  const details = {
    originalHash: onChain.record.contentHash,
    currentHash,
    registeredAt: new Date(onChain.record.timestamp * 1000).toISOString(),
    txHash: rec?.txHash ?? null,
    blockNumber: rec?.blockNumber ?? null,
    registrar: onChain.record.registrar,
    contractAddress: rec?.contractAddress ?? null,
    chainId: rec?.chainId ?? null,
  };
  if (equalHashes(onChain.record.contentHash, currentHash)) {
    return { ...base, ...details, status: 'VERIFIED', message: 'The document matches its blockchain record.' };
  }
  return {
    ...base, ...details, status: 'TAMPERED',
    message: 'The document hash does not match the hash registered on the blockchain. The file has been altered.',
  };
}
