import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { COOKIE_NAME, verifyToken } from '../services/auth.service';
import { logAudit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { Role } from '../utils/constants';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[COOKIE_NAME];
}

/** Requires a valid JWT and an existing, active account (re-checked on every request). */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized();
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw AppError.unauthorized('Invalid or expired session');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw AppError.unauthorized('Account no longer exists');
    if (!user.isActive) throw new AppError(403, 'Account is deactivated', 'ACCOUNT_DISABLED');
    // Role always comes from the database, never from the token, so role changes apply immediately.
    req.user = { id: user.id, role: user.role as Role, name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

/** Reusable authorization middleware: allows only the listed roles. Must follow `authenticate`. */
export const authorize =
  (...roles: Role[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      await logAudit(req, {
        action: 'UNAUTHORIZED_ACCESS',
        outcome: 'DENIED',
        resourceType: 'route',
        resourceId: `${req.method} ${req.baseUrl}${req.path}`,
        metadata: { requiredRoles: roles },
      });
      return next(AppError.forbidden());
    }
    next();
  };

/** Rejects malformed ObjectIds with 400 before they reach the database. */
export const validateObjectId =
  (...params: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    for (const p of params) {
      if (!mongoose.isValidObjectId(req.params[p])) return next(AppError.badRequest(`Invalid ${p}`));
    }
    next();
  };
