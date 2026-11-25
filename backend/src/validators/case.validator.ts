import { z } from 'zod';
import { CASE_CATEGORIES, CASE_STATUSES } from '../utils/constants';

const str = (max: number) => z.string().trim().max(max);
const stringList = z.array(z.string().trim().min(1).max(200)).max(30);

const caseFields = {
  title: str(300).min(3),
  caseNumber: str(100).min(1),
  citation: str(200).optional(),
  court: str(200).min(2),
  year: z.coerce.number().int().min(1700).max(2100),
  category: z.enum(CASE_CATEGORIES),
  petitioner: str(300).optional(),
  respondent: str(300).optional(),
  bench: str(500).optional(),
  decisionDate: z.coerce.date().optional(),
  summary: str(10000).min(10),
  keyHoldings: stringList.optional(),
  tags: stringList.optional(),
  sourceUrl: z.string().trim().url().max(500).optional(),
};

export const createCaseSchema = z.object(caseFields).strict();
export const updateCaseSchema = z.object(caseFields).partial().strict();

export const approveSchema = z
  .object({ decision: z.enum(['APPROVE', 'REJECT']), note: str(1000).optional() })
  .strict()
  .refine((v) => v.decision === 'APPROVE' || (v.note && v.note.length >= 3), {
    message: 'A note is required when rejecting a case',
    path: ['note'],
  });

export const listCasesQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: str(200).optional(),
  title: str(200).optional(),
  caseNumber: str(100).optional(),
  court: str(200).optional(),
  year: z.coerce.number().int().min(1700).max(2100).optional(),
  category: z.enum(CASE_CATEGORIES).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  mine: z.enum(['true', 'false']).optional(),
  sort: z.enum(['recent', 'year_desc', 'year_asc', 'title']).optional(),
});

export const bookmarkSchema = z.object({ caseId: z.string().length(24), note: str(500).optional() }).strict();
