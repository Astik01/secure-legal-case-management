import { api, compact, get, getPaged, send } from './api';
import type {
  AuditEntry, Bookmark, ChainRecord, LegalCase, LegalDocument, DocVersion, Role, User, VerificationResult,
} from '../types';

export type CaseInput = Partial<Omit<LegalCase, '_id' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'>>;

export const authApi = {
  login: (email: string, password: string) => send<{ user: User }>('post', '/auth/login', { email, password }),
  register: (body: { name: string; email: string; password: string; institution?: string; enrollmentId?: string }) =>
    send<{ user: User }>('post', '/auth/register', compact(body)),
  logout: () => send<null>('post', '/auth/logout'),
  me: () => get<{ user: User }>('/auth/me'),
};

export const userApi = {
  list: (params: object) => getPaged<User>('/users', params),
  create: (body: object) => send<User>('post', '/users', body),
  update: (id: string, body: object) => send<User>('put', `/users/${id}`, compact(body as Record<string, unknown>)),
  setRole: (id: string, role: Role) => send<User>('patch', `/users/${id}/role`, { role }),
  setStatus: (id: string, isActive: boolean) => send<User>('patch', `/users/${id}/status`, { isActive }),
};

export const caseApi = {
  list: (params: object) => getPaged<LegalCase>('/cases', params),
  filters: () => get<{ courts: string[]; years: number[]; categories: string[] }>('/cases/meta/filters'),
  get: (id: string) => get<LegalCase>(`/cases/${id}`),
  create: (body: CaseInput) => send<LegalCase>('post', '/cases', body),
  update: (id: string, body: CaseInput) => send<LegalCase>('put', `/cases/${id}`, body),
  submit: (id: string) => send<LegalCase>('patch', `/cases/${id}/submit`),
  review: (id: string, decision: 'APPROVE' | 'REJECT', note?: string) =>
    send<LegalCase>('patch', `/cases/${id}/approve`, compact({ decision, note })),
  archive: (id: string) => send<LegalCase>('patch', `/cases/${id}/archive`),
  remove: (id: string) => send<null>('delete', `/cases/${id}`),
};

export const bookmarkApi = {
  list: (params?: object) => getPaged<Bookmark>('/bookmarks', params),
  add: (caseId: string, note?: string) => send<Bookmark>('post', '/bookmarks', compact({ caseId, note })),
  remove: (id: string) => send<null>('delete', `/bookmarks/${id}`),
};

export const documentApi = {
  forCase: (caseId: string) => get<LegalDocument[]>('/documents', { caseId }),
  get: (id: string) => get<LegalDocument>(`/documents/${id}`),
  versions: (id: string) => get<DocVersion[]>(`/documents/${id}/versions`),
  upload: async (form: { file: File; caseId: string; title?: string; documentId?: string }) => {
    const data = new FormData();
    data.append('caseId', form.caseId);
    if (form.title) data.append('title', form.title);
    if (form.documentId) data.append('documentId', form.documentId);
    data.append('file', form.file);
    const res = await api.post('/documents/upload', data);
    return res.data.data as { document: LegalDocument; version: DocVersion; blockchain: ChainRecord | null };
  },
  /** Fetches the PDF through the authenticated API and returns a temporary object URL. */
  blobUrl: async (id: string, version?: number) => {
    const res = await api.get(`/documents/${id}/download`, {
      params: { inline: 'true', ...(version ? { version } : {}) },
      responseType: 'blob',
    });
    return URL.createObjectURL(res.data as Blob);
  },
  downloadUrl: (id: string, version?: number) => `/api/documents/${id}/download${version ? `?version=${version}` : ''}`,
};

export const chainApi = {
  records: (documentId: string) => get<ChainRecord[]>(`/blockchain/records/${documentId}`),
  allRecords: (params: object) => getPaged<ChainRecord>('/blockchain/records', params),
  register: (documentId: string, version?: number) =>
    send<ChainRecord[]>('post', '/blockchain/register', compact({ documentId, version })),
  verify: (documentId: string, version?: number) =>
    get<VerificationResult>(`/blockchain/verify/${documentId}`, version ? { version } : undefined),
  verifyCopy: async (documentId: string, file: File, version?: number) => {
    const data = new FormData();
    data.append('file', file);
    const res = await api.post(`/blockchain/verify/${documentId}/file`, data, { params: version ? { version } : undefined });
    return res.data.data as VerificationResult;
  },
  history: (params: object) => getPaged<AuditEntry>('/blockchain/verifications', params),
  status: () => get<Record<string, unknown>>('/blockchain/status'),
};

export const auditApi = {
  list: (params: object) => getPaged<AuditEntry>('/audit-logs', params),
  actions: () => get<string[]>('/audit-logs/actions'),
};

export const statsApi = {
  dashboard: () => get<Record<string, any>>('/dashboard'), // eslint-disable-line @typescript-eslint/no-explicit-any
  analytics: () => get<Record<string, any>>('/analytics'), // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: () => get<Record<string, any>>('/system/settings'), // eslint-disable-line @typescript-eslint/no-explicit-any
};
