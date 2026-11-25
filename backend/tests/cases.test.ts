import request from 'supertest';
import { createApp } from '../src/app';
import { AuditLog } from '../src/models/AuditLog';
import { LegalCase } from '../src/models/LegalCase';
import { bearer, clearCollections, createUser, loginAs, seedRoles, startTestDb, stopTestDb } from './helpers';

const app = createApp();
beforeAll(() => startTestDb('cases'));
afterAll(() => stopTestDb());
beforeEach(() => clearCollections());

const payload = (over: object = {}) => ({
  title: 'Maneka Gandhi v. Union of India',
  caseNumber: 'WP 231/1977',
  citation: '(1978) 1 SCC 248',
  court: 'Supreme Court of India',
  year: 1978,
  category: 'Constitutional Law',
  petitioner: 'Maneka Gandhi',
  respondent: 'Union of India',
  summary: 'Expanded the scope of Article 21 and established the due-process style reading of procedure.',
  tags: ['article 21'],
  ...over,
});

async function createAs(token: string, over: object = {}) {
  return request(app).post('/api/cases').set(bearer(token)).send(payload(over));
}

describe('Case creation and RBAC', () => {
  it('lets faculty create cases as DRAFT owned by them', async () => {
    const { facultyToken, faculty } = await seedRoles(app);
    const res = await createAs(facultyToken);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'DRAFT', createdBy: faculty.id });
    expect(await AuditLog.countDocuments({ action: 'CASE_CREATED' })).toBe(1);
  });

  it('forbids students from creating, updating and deleting cases', async () => {
    const { studentToken, facultyToken } = await seedRoles(app);
    expect((await createAs(studentToken)).status).toBe(403);
    const c = (await createAs(facultyToken)).body.data;
    expect((await request(app).put(`/api/cases/${c._id}`).set(bearer(studentToken)).send({ title: 'x y z' })).status).toBe(403);
    expect((await request(app).delete(`/api/cases/${c._id}`).set(bearer(studentToken))).status).toBe(403);
  });

  it('forbids faculty from deleting, approving, and archiving', async () => {
    const { facultyToken } = await seedRoles(app);
    const c = (await createAs(facultyToken)).body.data;
    expect((await request(app).delete(`/api/cases/${c._id}`).set(bearer(facultyToken))).status).toBe(403);
    expect((await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(facultyToken)).send({ decision: 'APPROVE' })).status).toBe(403);
    expect((await request(app).patch(`/api/cases/${c._id}/archive`).set(bearer(facultyToken))).status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/cases')).status).toBe(401);
    expect((await request(app).post('/api/cases').send(payload())).status).toBe(401);
  });

  it('validates input and rejects unknown fields (no mass assignment)', async () => {
    const { facultyToken } = await seedRoles(app);
    expect((await createAs(facultyToken, { year: 'abc' })).status).toBe(400);
    expect((await createAs(facultyToken, { category: 'Nonsense' })).status).toBe(400);
    expect((await createAs(facultyToken, { status: 'PUBLISHED' })).status).toBe(400);
    expect((await createAs(facultyToken, { createdBy: '64b64b64b64b64b64b64b64b' })).status).toBe(400);
  });

  it('prevents duplicate case numbers with 409', async () => {
    const { facultyToken } = await seedRoles(app);
    await createAs(facultyToken);
    expect((await createAs(facultyToken)).status).toBe(409);
  });
});

describe('Approval workflow and visibility', () => {
  it('moves a case DRAFT -> PENDING -> PUBLISHED and makes it visible to students', async () => {
    const { facultyToken, adminToken, studentToken, admin } = await seedRoles(app);
    const c = (await createAs(facultyToken)).body.data;

    expect((await request(app).get(`/api/cases/${c._id}`).set(bearer(studentToken))).status).toBe(404);
    expect((await request(app).get('/api/cases').set(bearer(studentToken))).body.meta.total).toBe(0);

    expect((await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'APPROVE' })).status).toBe(409);
    const submit = await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(facultyToken));
    expect(submit.body.data.status).toBe('PENDING');
    const approve = await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'APPROVE' });
    expect(approve.status).toBe(200);
    expect(approve.body.data).toMatchObject({ status: 'PUBLISHED', reviewedBy: admin.id });

    expect((await request(app).get(`/api/cases/${c._id}`).set(bearer(studentToken))).status).toBe(200);
    expect((await request(app).get('/api/cases').set(bearer(studentToken))).body.meta.total).toBe(1);
    for (const a of ['CASE_SUBMITTED', 'CASE_APPROVED']) expect(await AuditLog.countDocuments({ action: a })).toBe(1);
  });

  it('requires a note to reject; faculty can edit and resubmit a rejected case', async () => {
    const { facultyToken, adminToken } = await seedRoles(app);
    const c = (await createAs(facultyToken)).body.data;
    await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(facultyToken));
    expect((await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'REJECT' })).status).toBe(400);
    const rej = await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'REJECT', note: 'Add the citation' });
    expect(rej.body.data).toMatchObject({ status: 'REJECTED', reviewNote: 'Add the citation' });
    const edit = await request(app).put(`/api/cases/${c._id}`).set(bearer(facultyToken)).send({ citation: '(1978) 1 SCC 248' });
    expect(edit.body.data.status).toBe('DRAFT');
    expect((await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(facultyToken))).body.data.status).toBe('PENDING');
  });

  it('stops faculty from editing pending or published cases, and other faculty cases', async () => {
    const { facultyToken, adminToken } = await seedRoles(app);
    const other = await createUser('FACULTY', 'other@test.dev');
    const otherToken = await loginAs(app, other.email);
    const c = (await createAs(facultyToken)).body.data;
    // Another faculty member cannot see a draft they do not own -> 404
    expect((await request(app).put(`/api/cases/${c._id}`).set(bearer(otherToken)).send({ title: 'Hijacked title' })).status).toBe(404);
    await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(facultyToken));
    expect((await request(app).put(`/api/cases/${c._id}`).set(bearer(facultyToken)).send({ title: 'Edited while pending' })).status).toBe(409);
    await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'APPROVE' });
    // Published: visible to other faculty but not editable by them
    expect((await request(app).put(`/api/cases/${c._id}`).set(bearer(otherToken)).send({ title: 'Hijacked title' })).status).toBe(403);
    expect(await AuditLog.countDocuments({ action: 'UNAUTHORIZED_ACCESS' })).toBeGreaterThanOrEqual(1);
  });

  it('lets admin edit, archive and delete; archived cases disappear for students', async () => {
    const { facultyToken, adminToken, studentToken } = await seedRoles(app);
    const c = (await createAs(facultyToken)).body.data;
    await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(facultyToken));
    await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'APPROVE' });
    expect((await request(app).put(`/api/cases/${c._id}`).set(bearer(adminToken)).send({ title: 'Corrected title' })).body.data.title).toBe('Corrected title');
    expect((await request(app).patch(`/api/cases/${c._id}/archive`).set(bearer(adminToken))).body.data.status).toBe('ARCHIVED');
    expect((await request(app).get(`/api/cases/${c._id}`).set(bearer(studentToken))).status).toBe(404);
    expect((await request(app).delete(`/api/cases/${c._id}`).set(bearer(adminToken))).status).toBe(200);
    expect(await LegalCase.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'CASE_DELETED' })).toBe(1);
  });
});

describe('Search, filtering and pagination', () => {
  async function seedPublished() {
    const roles = await seedRoles(app);
    const rows = [
      { title: 'Kesavananda Bharati v. State of Kerala', caseNumber: 'WP 135/1970', year: 1973, court: 'Supreme Court of India', category: 'Constitutional Law' },
      { title: 'Maneka Gandhi v. Union of India', caseNumber: 'WP 231/1977', year: 1978, court: 'Supreme Court of India', category: 'Constitutional Law' },
      { title: 'Vishaka v. State of Rajasthan', caseNumber: 'WP 666/1992', year: 1997, court: 'Supreme Court of India', category: 'Human Rights' },
      { title: 'Delhi High Court sample matter', caseNumber: 'DHC 1/2010', year: 2010, court: 'Delhi High Court', category: 'Civil Law' },
    ];
    for (const r of rows) {
      const c = (await createAs(roles.facultyToken, r)).body.data;
      await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(roles.facultyToken));
      await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(roles.adminToken)).send({ decision: 'APPROVE' });
    }
    return roles;
  }

  it('searches by free text, title, case number, court, year and category', async () => {
    const { studentToken } = await seedPublished();
    const get = async (qs: string) => (await request(app).get(`/api/cases?${qs}`).set(bearer(studentToken))).body;
    expect((await get('q=kesavananda')).meta.total).toBe(1);
    expect((await get('title=gandhi')).meta.total).toBe(1);
    expect((await get('caseNumber=666')).data[0].title).toMatch(/Vishaka/);
    expect((await get('court=delhi')).meta.total).toBe(1);
    expect((await get('year=1978')).meta.total).toBe(1);
    expect((await get('category=Constitutional%20Law')).meta.total).toBe(2);
    expect((await get('category=Constitutional%20Law&year=1973')).meta.total).toBe(1);
  });

  it('paginates and sorts', async () => {
    const { studentToken } = await seedPublished();
    const page1 = await request(app).get('/api/cases?limit=3&sort=year_asc').set(bearer(studentToken));
    expect(page1.body.data).toHaveLength(3);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(page1.body.data[0].year).toBe(1973);
    const page2 = await request(app).get('/api/cases?limit=3&page=2&sort=year_asc').set(bearer(studentToken));
    expect(page2.body.data).toHaveLength(1);
  });

  it('treats regex characters and operator objects in search input as plain text', async () => {
    const { studentToken } = await seedPublished();
    const rx = await request(app).get('/api/cases?q=.*').set(bearer(studentToken));
    expect(rx.body.meta.total).toBe(0);
    const op = await request(app).get('/api/cases?year[$gt]=0').set(bearer(studentToken));
    expect(op.status).toBe(400);
  });

  it('exposes filter options and honours faculty "mine" filter', async () => {
    const { studentToken, facultyToken } = await seedPublished();
    await createAs(facultyToken, { caseNumber: 'DRAFT-1', title: 'My private draft' });
    const meta = await request(app).get('/api/cases/meta/filters').set(bearer(studentToken));
    expect(meta.body.data.courts).toEqual(['Delhi High Court', 'Supreme Court of India']);
    const mine = await request(app).get('/api/cases?mine=true&status=DRAFT').set(bearer(facultyToken));
    expect(mine.body.meta.total).toBe(1);
    const studentSees = await request(app).get('/api/cases?q=private').set(bearer(studentToken));
    expect(studentSees.body.meta.total).toBe(0);
  });
});

describe('Bookmarks', () => {
  it('lets students bookmark visible cases, list and remove them, but not others bookmarks', async () => {
    const { facultyToken, adminToken, studentToken } = await seedRoles(app);
    const c = (await createAs(facultyToken)).body.data;
    expect((await request(app).post('/api/bookmarks').set(bearer(studentToken)).send({ caseId: c._id })).status).toBe(404);
    await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(facultyToken));
    await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(adminToken)).send({ decision: 'APPROVE' });

    const add = await request(app).post('/api/bookmarks').set(bearer(studentToken)).send({ caseId: c._id, note: 'Exam topic' });
    expect(add.status).toBe(201);
    expect((await request(app).post('/api/bookmarks').set(bearer(studentToken)).send({ caseId: c._id })).status).toBe(409);
    const list = await request(app).get('/api/bookmarks').set(bearer(studentToken));
    expect(list.body.data[0].legalCase.title).toMatch(/Maneka/);
    const detail = await request(app).get(`/api/cases/${c._id}`).set(bearer(studentToken));
    expect(detail.body.data.bookmarkId).toBe(add.body.data._id);

    expect((await request(app).delete(`/api/bookmarks/${add.body.data._id}`).set(bearer(facultyToken))).status).toBe(404);
    expect((await request(app).delete(`/api/bookmarks/${add.body.data._id}`).set(bearer(studentToken))).status).toBe(200);
    expect((await request(app).get('/api/bookmarks').set(bearer(studentToken))).body.meta.total).toBe(0);
  });
});
