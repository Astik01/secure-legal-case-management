import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

type Source = 'body' | 'query' | 'params';

/** Validates and replaces req[source] with the parsed (typed, unknown-keys-stripped) value. */
export const validate =
  (schema: ZodTypeAny, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    if (source === 'query') {
      for (const k of Object.keys(req.query)) delete (req.query as Record<string, unknown>)[k];
      Object.assign(req.query, result.data);
    } else {
      (req as unknown as Record<string, unknown>)[source] = result.data;
    }
    next();
  };
