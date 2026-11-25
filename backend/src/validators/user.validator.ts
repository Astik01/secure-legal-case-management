import { z } from 'zod';
import { ROLES } from '../utils/constants';

const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

export const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  isActive: bool.optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    institution: z.string().trim().max(150).optional(),
    enrollmentId: z.string().trim().max(50).optional(),
  })
  .strict();

export const roleSchema = z.object({ role: z.enum(ROLES) }).strict();
export const statusSchema = z.object({ isActive: z.boolean() }).strict();
