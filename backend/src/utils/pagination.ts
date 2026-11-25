import { PageMeta } from './apiResponse';

export function parsePagination(query: { page?: unknown; limit?: unknown }, maxLimit = 100) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(query.limit ?? '10'), 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

export const buildMeta = (page: number, limit: number, total: number): PageMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Escapes user text for safe use inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
