import { Request, Response } from 'express';
import { User } from '../models/User';
import { hashPassword } from '../services/auth.service';
import { logAudit } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/apiResponse';
import { buildMeta, escapeRegex, parsePagination } from '../utils/pagination';

export async function listUsers(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, role, isActive } = req.query as { search?: string; role?: string; isActive?: boolean };
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, items, undefined, 200, buildMeta(page, limit, total));
}

export async function createUser(req: Request, res: Response) {
  const { name, email, password, role, institution, enrollmentId } = req.body;
  if (await User.exists({ email })) throw AppError.conflict('An account with this email already exists');
  const user = await User.create({
    name, email, role, institution, enrollmentId, passwordHash: await hashPassword(password),
  });
  await logAudit(req, { action: 'USER_CREATED', resourceType: 'user', resourceId: user.id, metadata: { role } });
  return created(res, user, 'User created');
}

export async function getUser(req: Request, res: Response) {
  const { id } = req.params;
  if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
    await logAudit(req, { action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED', resourceType: 'user', resourceId: id });
    throw AppError.forbidden();
  }
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  return ok(res, user);
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const isAdmin = req.user!.role === 'ADMIN';
  if (!isAdmin && req.user!.id !== id) {
    await logAudit(req, { action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED', resourceType: 'user', resourceId: id });
    throw AppError.forbidden();
  }
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  const { email, ...profile } = req.body;
  if (email && email !== user.email) {
    if (!isAdmin) throw AppError.forbidden('Only administrators can change an email address');
    if (await User.exists({ email, _id: { $ne: id } })) throw AppError.conflict('Email already in use');
    user.email = email;
  }
  Object.assign(user, profile);
  await user.save();
  await logAudit(req, {
    action: 'USER_UPDATED', resourceType: 'user', resourceId: id, metadata: { fields: Object.keys(req.body) },
  });
  return ok(res, user, 'User updated');
}

async function ensureNotLastAdmin(userId: string) {
  const others = await User.countDocuments({ role: 'ADMIN', isActive: true, _id: { $ne: userId } });
  if (others === 0) throw AppError.badRequest('Cannot remove or deactivate the last active administrator');
}

export async function changeRole(req: Request, res: Response) {
  const { id } = req.params;
  const { role } = req.body;
  if (id === req.user!.id) throw AppError.forbidden('You cannot change your own role');
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  const previous = user.role;
  if (previous === 'ADMIN' && role !== 'ADMIN') await ensureNotLastAdmin(id);
  user.role = role;
  await user.save();
  await logAudit(req, {
    action: 'USER_ROLE_CHANGED', resourceType: 'user', resourceId: id, metadata: { from: previous, to: role },
  });
  return ok(res, user, 'Role updated');
}

export async function changeStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { isActive } = req.body;
  if (id === req.user!.id) throw AppError.forbidden('You cannot change your own account status');
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  if (!isActive && user.role === 'ADMIN') await ensureNotLastAdmin(id);
  user.isActive = isActive;
  await user.save();
  await logAudit(req, {
    action: 'USER_STATUS_CHANGED', resourceType: 'user', resourceId: id, metadata: { isActive },
  });
  return ok(res, user, isActive ? 'User activated' : 'User deactivated');
}
