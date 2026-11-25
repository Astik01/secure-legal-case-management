import { Types } from 'mongoose';
import { LegalCase } from '../models/LegalCase';
import { AppError } from '../utils/AppError';
import { Role } from '../utils/constants';

export interface Actor {
  id: string;
  role: Role;
}

/** Which cases an actor may see. Students: published only. Faculty: published + own. Admin: all. */
export function visibilityFilter(actor: Actor): Record<string, unknown> {
  if (actor.role === 'ADMIN') return {};
  if (actor.role === 'FACULTY') {
    return { $or: [{ status: 'PUBLISHED' }, { createdBy: new Types.ObjectId(actor.id) }] };
  }
  return { status: 'PUBLISHED' };
}

/** Loads a case if the actor may view it; otherwise 404 (does not reveal unpublished cases). */
export async function getViewableCase(caseId: string, actor: Actor) {
  const found = await LegalCase.findOne({ _id: caseId, ...visibilityFilter(actor) });
  if (!found) throw AppError.notFound('Case not found');
  return found;
}

export function isOwner(legalCase: { createdBy: unknown }, actor: Actor): boolean {
  return String(legalCase.createdBy) === actor.id;
}
