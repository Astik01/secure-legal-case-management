export type Role = 'STUDENT' | 'FACULTY' | 'ADMIN';
export type CaseStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
export type ChainStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
export type VerificationStatus = 'VERIFIED' | 'TAMPERED' | 'NOT_REGISTERED' | 'VERIFICATION_ERROR';

export const CASE_CATEGORIES = [
  'Constitutional Law', 'Criminal Law', 'Civil Law', 'Family Law', 'Labour & Employment',
  'Intellectual Property', 'Environmental Law', 'Tax & Corporate', 'Human Rights', 'Other',
] as const;

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  institution?: string;
  enrollmentId?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface LegalCase {
  _id: string;
  title: string;
  caseNumber: string;
  citation?: string;
  court: string;
  year: number;
  category: string;
  petitioner?: string;
  respondent?: string;
  bench?: string;
  decisionDate?: string;
  summary: string;
  keyHoldings: string[];
  tags: string[];
  sourceUrl?: string;
  status: CaseStatus;
  createdBy: string | { _id: string; name: string };
  reviewedBy?: string | { _id: string; name: string };
  reviewNote?: string;
  submittedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  bookmarkId?: string | null;
}

export interface DocVersion {
  _id: string;
  version: number;
  originalName: string;
  safeName: string;
  size: number;
  sha256: string;
  uploadedBy: string | { _id: string; name: string };
  createdAt: string;
}

export interface LegalDocument {
  _id: string;
  legalCase: string;
  title: string;
  documentKey: string;
  currentVersion: number;
  isDemo: boolean;
  createdAt: string;
  current?: DocVersion | null;
  versions?: DocVersion[];
}

export interface ChainRecord {
  _id: string;
  document: string | { _id: string; title: string; legalCase?: { title: string; caseNumber: string } };
  version: number;
  documentKey: string;
  contentHash: string;
  status: ChainStatus;
  txHash?: string;
  blockNumber?: number;
  chainId?: number;
  contractAddress?: string;
  registrar?: string;
  chainTimestamp?: string;
  error?: string;
  submittedAt?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  documentId: string;
  documentKey: string;
  version: number;
  source: 'STORED_FILE' | 'UPLOADED_COPY';
  originalHash: string | null;
  currentHash: string | null;
  databaseHash: string;
  registeredAt: string | null;
  txHash?: string | null;
  blockNumber?: number | null;
  registrar?: string | null;
  contractAddress?: string | null;
  chainId?: number | null;
  verifiedAt: string;
}

export interface AuditEntry {
  _id: string;
  actor?: { _id: string; name: string; email?: string; role: Role } | null;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface Bookmark {
  _id: string;
  legalCase: LegalCase;
  note?: string;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}
