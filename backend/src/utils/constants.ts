export const ROLES = ['STUDENT', 'FACULTY', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const CASE_STATUSES = ['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_CATEGORIES = [
  'Constitutional Law',
  'Criminal Law',
  'Civil Law',
  'Family Law',
  'Labour & Employment',
  'Intellectual Property',
  'Environmental Law',
  'Tax & Corporate',
  'Human Rights',
  'Other',
] as const;

export const CHAIN_STATUSES = ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'] as const;
export type ChainStatus = (typeof CHAIN_STATUSES)[number];

export const VERIFICATION_STATUSES = ['VERIFIED', 'TAMPERED', 'NOT_REGISTERED', 'VERIFICATION_ERROR'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
