import { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, message?: string, status = 200, meta?: PageMeta) {
  return res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}
export const created = <T>(res: Response, data: T, message?: string) => ok(res, data, message, 201);
