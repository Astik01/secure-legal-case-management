import { Router } from 'express';
import { z } from 'zod';
import * as audit from '../controllers/audit.controller';
import * as analytics from '../controllers/analytics.controller';
import { authenticate, authorize, validateObjectId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const oid = z.string().regex(/^[a-f0-9]{24}$/i);
const auditQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  action: z.string().max(80).optional(),
  outcome: z.enum(['SUCCESS', 'FAILURE', 'DENIED']).optional(),
  actor: oid.optional(),
  resourceType: z.string().max(40).optional(),
  resourceId: z.string().max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Read-only: there are deliberately no POST/PUT/PATCH/DELETE routes for audit logs. */
export const auditRouter = Router();
auditRouter.use(authenticate, authorize('ADMIN', 'FACULTY'));
auditRouter.get('/', validate(auditQuery, 'query'), asyncHandler(audit.listAuditLogs));
auditRouter.get('/actions', asyncHandler(audit.auditActions));
auditRouter.get('/:id', validateObjectId('id'), asyncHandler(audit.getAuditLog));

export const analyticsRouter = Router();
// Auth is applied per route (not router-wide) because this router is mounted at the API root.
analyticsRouter.get('/dashboard', authenticate, asyncHandler(analytics.dashboard));
analyticsRouter.get('/analytics', authenticate, authorize('ADMIN'), asyncHandler(analytics.adminAnalytics));
analyticsRouter.get('/system/settings', authenticate, authorize('ADMIN'), asyncHandler(analytics.systemSettings));
