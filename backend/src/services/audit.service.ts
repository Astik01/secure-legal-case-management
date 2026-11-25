import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';

export interface AuditEntry {
  actor?: unknown;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: unknown;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = /pass(word)?|secret|token|private|authorization|cookie/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : scrub(v, depth + 1);
  }
  return out;
}

/** Records an audit entry. Never throws: auditing must not break the request path. */
export async function logAudit(req: Request | undefined, entry: AuditEntry): Promise<void> {
  try {
    const actor = entry.actor ?? req?.user?.id;
    await AuditLog.create({
      actor,
      actorRole: entry.actorRole ?? req?.user?.role,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId !== undefined ? String(entry.resourceId) : undefined,
      outcome: entry.outcome ?? 'SUCCESS',
      metadata: entry.metadata ? scrub(entry.metadata) : undefined,
      ip: req?.ip,
      userAgent: req?.get('user-agent')?.slice(0, 300),
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err instanceof Error ? err.message : err);
  }
}
