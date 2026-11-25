import { Request, Response } from 'express';
import { env } from '../config/env';
import { AuditLog } from '../models/AuditLog';
import { BlockchainRecord } from '../models/BlockchainRecord';
import { Bookmark } from '../models/Bookmark';
import { DocumentModel } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';
import { LegalCase } from '../models/LegalCase';
import { User } from '../models/User';
import { getBlockchain } from '../services/blockchain.service';
import { visibilityFilter } from '../services/case.service';
import { ok } from '../utils/apiResponse';

type Bucket = { _id: string | number; count: number };
const toMap = (rows: Bucket[]) => Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
const groupCount = (field: string) => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }];

export async function adminAnalytics(_req: Request, res: Response) {
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const since14 = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const [users, casesByStatus, casesByCategory, casesByYear, casesByCourt, chain, verifications, activity, docs, versions] =
    await Promise.all([
      User.aggregate<Bucket>(groupCount('role')),
      LegalCase.aggregate<Bucket>(groupCount('status')),
      LegalCase.aggregate<Bucket>(groupCount('category')),
      LegalCase.aggregate<Bucket>([...groupCount('year'), { $sort: { _id: 1 } }]),
      LegalCase.aggregate<Bucket>([...groupCount('court'), { $sort: { count: -1 } }, { $limit: 8 }]),
      BlockchainRecord.aggregate<Bucket>(groupCount('status')),
      AuditLog.aggregate<Bucket>([
        { $match: { action: 'DOCUMENT_VERIFIED', createdAt: { $gte: since30 } } },
        { $group: { _id: '$metadata.status', count: { $sum: 1 } } },
      ]),
      AuditLog.aggregate<Bucket>([
        { $match: { createdAt: { $gte: since14 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      DocumentModel.countDocuments(),
      DocumentVersion.countDocuments(),
    ]);
  const failedLogins = await AuditLog.countDocuments({ action: 'USER_LOGIN_FAILED', createdAt: { $gte: since30 } });
  const denied = await AuditLog.countDocuments({ outcome: 'DENIED', createdAt: { $gte: since30 } });
  return ok(res, {
    users: { byRole: toMap(users), total: users.reduce((a, b) => a + b.count, 0) },
    cases: {
      byStatus: toMap(casesByStatus),
      byCategory: toMap(casesByCategory),
      byYear: casesByYear.map((r) => ({ year: Number(r._id), count: r.count })),
      byCourt: casesByCourt.map((r) => ({ court: String(r._id), count: r.count })),
      total: casesByStatus.reduce((a, b) => a + b.count, 0),
    },
    documents: { total: docs, versions },
    blockchain: { byStatus: toMap(chain) },
    verifications: { last30Days: toMap(verifications) },
    security: { failedLoginsLast30Days: failedLogins, deniedRequestsLast30Days: denied },
    activityLast14Days: activity.map((r) => ({ date: String(r._id), count: r.count })),
  });
}

export async function dashboard(req: Request, res: Response) {
  const user = req.user!;
  const visible = visibilityFilter(user);
  const recentCases = await LegalCase.find(visible).sort({ updatedAt: -1 }).limit(5).select('title caseNumber court year category status');

  if (user.role === 'STUDENT') {
    const [published, bookmarks, verifications] = await Promise.all([
      LegalCase.countDocuments({ status: 'PUBLISHED' }),
      Bookmark.countDocuments({ user: user.id }),
      AuditLog.countDocuments({ action: 'DOCUMENT_VERIFIED', actor: user.id }),
    ]);
    const categories = await LegalCase.aggregate<Bucket>([{ $match: { status: 'PUBLISHED' } }, ...groupCount('category')]);
    return ok(res, { role: user.role, stats: { publishedCases: published, bookmarks, verifications }, categories: toMap(categories), recentCases });
  }

  if (user.role === 'FACULTY') {
    const mine = { createdBy: user.id };
    const [byStatus, caseIds] = await Promise.all([
      LegalCase.aggregate<Bucket>([{ $match: { createdBy: (await User.findById(user.id))!._id } }, ...groupCount('status')]),
      LegalCase.find(mine).distinct('_id'),
    ]);
    const docs = await DocumentModel.countDocuments({ legalCase: { $in: caseIds } });
    const docIds = await DocumentModel.find({ legalCase: { $in: caseIds } }).distinct('_id');
    const [confirmed, notConfirmed] = await Promise.all([
      BlockchainRecord.countDocuments({ document: { $in: docIds }, status: 'CONFIRMED' }),
      BlockchainRecord.countDocuments({ document: { $in: docIds }, status: { $ne: 'CONFIRMED' } }),
    ]);
    const rejected = await LegalCase.find({ ...mine, status: 'REJECTED' }).select('title caseNumber reviewNote').limit(5);
    return ok(res, {
      role: user.role,
      stats: { myCases: caseIds.length, myDocuments: docs, chainConfirmed: confirmed, chainUnconfirmed: notConfirmed },
      casesByStatus: toMap(byStatus),
      needsAttention: rejected,
      recentCases,
    });
  }

  const [pending, users, byStatus, chainFailed] = await Promise.all([
    LegalCase.find({ status: 'PENDING' }).sort({ submittedAt: 1 }).limit(5).populate('createdBy', 'name').select('title caseNumber submittedAt createdBy'),
    User.countDocuments({ isActive: true }),
    LegalCase.aggregate<Bucket>(groupCount('status')),
    BlockchainRecord.countDocuments({ status: { $in: ['FAILED', 'PENDING'] } }),
  ]);
  return ok(res, {
    role: user.role,
    stats: { activeUsers: users, pendingApprovals: toMap(byStatus).PENDING ?? 0, chainAttention: chainFailed, totalCases: byStatus.reduce((a, b) => a + b.count, 0) },
    casesByStatus: toMap(byStatus),
    pendingQueue: pending,
    recentCases,
  });
}

export async function systemSettings(_req: Request, res: Response) {
  const chain = await getBlockchain().status();
  return ok(res, {
    environment: env.NODE_ENV,
    upload: { maxUploadMb: env.MAX_UPLOAD_MB, allowedTypes: ['application/pdf'], storage: 'local-private' },
    security: { jwtExpiresIn: env.JWT_EXPIRES_IN, passwordHashing: 'bcrypt', rateLimiting: env.rateLimitEnabled, httpOnlyCookies: true },
    blockchain: chain,
    auditTrail: {
      store: 'MongoDB (append-only at application level)',
      note: 'Audit logs are a database trail, not blockchain-immutable. Only document hashes are anchored on-chain.',
    },
  });
}
