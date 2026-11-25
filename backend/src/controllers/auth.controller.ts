import { Request, Response } from 'express';
import { User } from '../models/User';
import { COOKIE_NAME, cookieOptions, hashPassword, signToken, verifyPassword } from '../services/auth.service';
import { logAudit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/apiResponse';

export async function register(req: Request, res: Response) {
  const { name, email, password, institution, enrollmentId } = req.body;
  if (await User.exists({ email })) throw AppError.conflict('An account with this email already exists');
  const user = await User.create({
    name, email, institution, enrollmentId, role: 'STUDENT', passwordHash: await hashPassword(password),
  });
  await logAudit(req, {
    actor: user.id, actorRole: user.role, action: 'USER_REGISTERED', resourceType: 'user', resourceId: user.id,
  });
  const token = signToken(user.id, 'STUDENT');
  res.cookie(COOKIE_NAME, token, cookieOptions(token));
  return created(res, { user, token }, 'Registration successful');
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    await logAudit(req, {
      actor: user?.id, action: 'USER_LOGIN_FAILED', outcome: 'FAILURE', resourceType: 'user',
      resourceId: user?.id, metadata: { reason: 'invalid_credentials' },
    });
    throw AppError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    await logAudit(req, {
      actor: user.id, action: 'USER_LOGIN_FAILED', outcome: 'DENIED', resourceType: 'user',
      resourceId: user.id, metadata: { reason: 'account_deactivated' },
    });
    throw new AppError(403, 'Account is deactivated. Contact an administrator.', 'ACCOUNT_DISABLED');
  }
  user.lastLoginAt = new Date();
  await user.save();
  await logAudit(req, {
    actor: user.id, actorRole: user.role, action: 'USER_LOGIN', resourceType: 'user', resourceId: user.id,
  });
  const token = signToken(user.id, user.role as 'STUDENT' | 'FACULTY' | 'ADMIN');
  res.cookie(COOKIE_NAME, token, cookieOptions(token));
  return ok(res, { user, token }, 'Login successful');
}

export async function logout(req: Request, res: Response) {
  await logAudit(req, { action: 'USER_LOGOUT', resourceType: 'user', resourceId: req.user?.id });
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return ok(res, null, 'Logged out');
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  return ok(res, { user });
}
