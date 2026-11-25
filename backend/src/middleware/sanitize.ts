import { NextFunction, Request, Response } from 'express';

/** Removes keys that start with `$` or contain `.` to block NoSQL operator injection. */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body) req.body = clean(req.body);
  if (req.query) {
    const cleaned = clean(req.query) as Record<string, unknown>;
    for (const k of Object.keys(req.query)) delete (req.query as Record<string, unknown>)[k];
    Object.assign(req.query, cleaned);
  }
  if (req.params) req.params = clean(req.params) as typeof req.params;
  next();
}
