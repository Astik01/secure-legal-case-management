import { z } from 'zod';

const objectId = z.string().length(24).regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const uploadBodySchema = z.object({
  caseId: objectId,
  title: z.string().trim().max(300).optional(),
  documentId: objectId.optional(),
});

export const listDocumentsQuery = z.object({ caseId: objectId });

export const versionQuery = z.object({
  version: z.coerce.number().int().min(1).optional(),
  inline: z.enum(['true', 'false']).optional(),
});
