import request from 'supertest';
import { createApp } from '../src/app';
import { AuditLog } from '../src/models/AuditLog';
import { bearer, clearCollections, createUser, loginAs, seedRoles, startTestDb, stopTestDb } from './helpers';
import { makePdf } from './pdf';

const app = createApp();
beforeAll(() => startTestDb('audit'));
afterAll(() => stopTestDb());
beforeEach(() => clearCollections());

const casePayload = {
  title: 'Kesavananda Bharati v. State of Kerala', caseNumber: 'WP 135/1970', court: 'Supreme Court of India',
  year: 1973, category: 'Constitutional Law', summary: 'Established the basic structure doctrine of the Constitution of India.',
};

async function scenario() {
  const roles = await seedRoles(app);
  const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
  await request(app).post('/api/documents/upload').set(bearer(roles.facultyToken)).field('caseId', c._id)
    .attach('file', await makePdf('audit'), { filename: 'a.pdf', contentType: 'application/pdf' });
  await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(roles.facultyToken));
  await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(roles.adminToken)).send({ decision: 'APPROVE' });
  return { ...roles, caseId: c._id as string };
}

describe('Audit logs', () => {
  it('records the key lifecycle events with actor, resource, outcome and timestamp', async () => {
    const { adminToken } = await scenario();
    const res = await request(app).get('/api/audit-logs?limit=100').set(bearer(adminToken));
    const actions = res.body.data.map((l: { action: string }) => l.action);
    for (const a of ['USER_LOGIN', 'CASE_CREATED', 'DOCUMENT_UPLOADED', 'BLOCKCHAIN_REGISTERED', 'CASE_SUBMITTED', 'CASE_APPROVED']) {
      expect(actions).toContain(a);
    }
    const created = res.body.data.find((l: { action: string }) => l.action === 'CASE_CREATED');
    expect(created).toMatchObject({ outcome: 'SUCCESS', resourceType: 'case', actorRole: 'FACULTY' });
    expect(created.actor.name).toBeTruthy();
    expect(created.createdAt).toBeTruthy();
  });

  it('is admin/faculty only, and faculty see just their own scope', async () => {
    const { studentToken, facultyToken, adminToken, caseId } = await scenario();
    expect((await request(app).get('/api/audit-logs').set(bearer(studentToken))).status).toBe(403);
    expect((await request(app).get('/api/audit-logs')).status).toBe(401);

    const other = await createUser('FACULTY', 'other@test.dev');
    const otherToken = await loginAs(app, other.email);
    await request(app).get('/api/users').set(bearer(otherToken)); // generates a DENIED entry for "other"
    const facultyLogs = (await request(app).get('/api/audit-logs?limit=100').set(bearer(facultyToken))).body;
    const otherLogs = (await request(app).get('/api/audit-logs?limit=100').set(bearer(otherToken))).body;
    const adminLogs = (await request(app).get('/api/audit-logs?limit=100').set(bearer(adminToken))).body;

    expect(facultyLogs.data.some((l: { action: string }) => l.action === 'CASE_APPROVED')).toBe(true); // admin action on their case
    expect(otherLogs.data.some((l: { resourceId: string }) => l.resourceId === caseId)).toBe(false);
    expect(otherLogs.data.every((l: { actor?: { _id: string } }) => !l.actor || l.actor._id === other.id)).toBe(true);
    expect(adminLogs.meta.total).toBeGreaterThan(facultyLogs.meta.total);
    // faculty cannot read an entry outside their scope by id
    const adminOnly = adminLogs.data.find((l: { actor?: { role: string }; resourceId?: string }) => l.actor?.role === 'ADMIN' && l.resourceId !== caseId);
    expect(adminOnly).toBeDefined();
    expect((await request(app).get(`/api/audit-logs/${adminOnly._id}`).set(bearer(otherToken))).status).toBe(404);
    expect((await request(app).get(`/api/audit-logs/${adminOnly._id}`).set(bearer(adminToken))).status).toBe(200);
  });

  it('filters by action, outcome and date and records unauthorized access attempts', async () => {
    const { studentToken, adminToken } = await scenario();
    await request(app).post('/api/cases').set(bearer(studentToken)).send(casePayload);
    const denied = await request(app).get('/api/audit-logs?outcome=DENIED').set(bearer(adminToken));
    expect(denied.body.data[0]).toMatchObject({ action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED', actorRole: 'STUDENT' });
    const byAction = await request(app).get('/api/audit-logs?action=USER_LOGIN').set(bearer(adminToken));
    expect(byAction.body.data.every((l: { action: string }) => l.action === 'USER_LOGIN')).toBe(true);
    const future = await request(app).get(`/api/audit-logs?from=${new Date(Date.now() + 86400000).toISOString()}`).set(bearer(adminToken));
    expect(future.body.meta.total).toBe(0);
    expect((await request(app).get('/api/audit-logs?outcome=BOGUS').set(bearer(adminToken))).status).toBe(400);
  });

  it('exposes no API that can modify or delete audit logs, and redacts secrets in metadata', async () => {
    const { adminToken } = await scenario();
    const entry = (await request(app).get('/api/audit-logs').set(bearer(adminToken))).body.data[0];
    for (const method of ['put', 'patch', 'delete', 'post'] as const) {
      const res = await request(app)[method](`/api/audit-logs/${entry._id}`).set(bearer(adminToken)).send({ action: 'X' });
      expect(res.status).toBe(404);
    }
    expect((await request(app).delete('/api/audit-logs').set(bearer(adminToken))).status).toBe(404);
    const { logAudit } = await import('../src/services/audit.service');
    await logAudit(undefined, { action: 'TEST_REDACT', metadata: { password: 'hunter2', nested: { token: 'abc', ok: 1 } } });
    const stored = await AuditLog.findOne({ action: 'TEST_REDACT' });
    expect(JSON.stringify(stored!.metadata)).not.toMatch(/hunter2|abc/);
    expect(JSON.stringify(stored!.metadata)).toContain('[REDACTED]');
  });
});

describe('Dashboards, analytics and settings', () => {
  it('serves role-specific dashboards', async () => {
    const { studentToken, facultyToken, adminToken } = await scenario();
    const s = (await request(app).get('/api/dashboard').set(bearer(studentToken))).body.data;
    expect(s.stats).toMatchObject({ publishedCases: 1, bookmarks: 0, verifications: 0 });
    const f = (await request(app).get('/api/dashboard').set(bearer(facultyToken))).body.data;
    expect(f.stats).toMatchObject({ myCases: 1, myDocuments: 1, chainConfirmed: 1, chainUnconfirmed: 0 });
    expect(f.casesByStatus.PUBLISHED).toBe(1);
    const a = (await request(app).get('/api/dashboard').set(bearer(adminToken))).body.data;
    expect(a.stats).toMatchObject({ activeUsers: 3, pendingApprovals: 0, totalCases: 1 });
  });

  it('restricts analytics and system settings to admins and never leaks secrets', async () => {
    const { studentToken, facultyToken, adminToken } = await scenario();
    for (const p of ['/api/analytics', '/api/system/settings']) {
      expect((await request(app).get(p).set(bearer(studentToken))).status).toBe(403);
      expect((await request(app).get(p).set(bearer(facultyToken))).status).toBe(403);
    }
    const an = (await request(app).get('/api/analytics').set(bearer(adminToken))).body.data;
    expect(an.users.byRole).toMatchObject({ ADMIN: 1, FACULTY: 1, STUDENT: 1 });
    expect(an.cases.byStatus.PUBLISHED).toBe(1);
    expect(an.cases.byCategory['Constitutional Law']).toBe(1);
    expect(an.documents).toMatchObject({ total: 1, versions: 1 });
    expect(an.blockchain.byStatus.CONFIRMED).toBe(1);
    expect(an.activityLast14Days.length).toBeGreaterThan(0);
    const settings = await request(app).get('/api/system/settings').set(bearer(adminToken));
    expect(settings.body.data.blockchain.connected).toBe(true);
    expect(JSON.stringify(settings.body)).not.toMatch(/JWT_SECRET|0xac0974|privateKey|test-only-secret/i);
  });
});
