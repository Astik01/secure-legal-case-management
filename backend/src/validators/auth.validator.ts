import { z } from 'zod';
import { ROLES } from '../utils/constants';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Public registration always creates STUDENT accounts; unknown keys (e.g. role) are stripped.
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  institution: z.string().trim().max(150).optional(),
  enrollmentId: z.string().trim().max(50).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const adminCreateUserSchema = registerSchema.extend({
  role: z.enum(ROLES).default('STUDENT'),
});
