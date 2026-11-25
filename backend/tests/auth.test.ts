import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { AuditLog } from '../src/models/AuditLog';
import { bearer, clearCollections, createUser, loginAs, PASSWORD, seedRoles, startTestDb, stopTestDb } from './helpers';

const app = createApp();

beforeAll(() => startTestDb('auth'));
afterAll(() => stopTestDb());
beforeEach(() => clearCollections());

const registration = { name: 'Asha Verma', email: 'asha@law.edu', password: 'Str0ngPass1' };

describe('Authentication', () => {
  it('registers a student with a hashed password and ignores a requested role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...registration, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const stored = await User.findOne({ email: registration.email }).select('+passwordHash');
    expect(stored!.passwordHash).not.toBe(registration.password);
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(await AuditLog.countDocuments({ action: 'USER_REGISTERED' })).toBe(1);
  });

  it('rejects duplicate registration', async () => {
    await request(app).post('/api/auth/register').send(registration);
    const res = await request(app).post('/api/auth/register').send(registration);
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords and invalid emails', async () => {
    const weak = await request(app).post('/api/auth/register').send({ ...registration, password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    const bad = await request(app).post('/api/auth/register').send({ ...registration, email: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('logs in with valid credentials and records the audit entry', async () => {
    await createUser('FACULTY', 'f@x.dev');
    const res = await request(app).post('/api/auth/login').send({ email: 'f@x.dev', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: 'USER_LOGIN', outcome: 'SUCCESS' })).toBe(1);
  });

  it('rejects an invalid password and an unknown email with the same message', async () => {
    await createUser('FACULTY', 'f@x.dev');
    const wrong = await request(app).post('/api/auth/login').send({ email: 'f@x.dev', password: 'wrongpass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@x.dev', password: 'wrongpass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(await AuditLog.countDocuments({ action: 'USER_LOGIN_FAILED' })).toBe(2);
  });

  it('blocks deactivated accounts from logging in and from using existing tokens', async () => {
    const { admin, student, adminToken, studentToken } = await seedRoles(app);
    expect(admin).toBeTruthy();
    await request(app).patch(`/api/users/${student.id}/status`).set(bearer(adminToken)).send({ isActive: false });
    const stale = await request(app).get('/api/auth/me').set(bearer(studentToken));
    expect(stale.status).toBe(403);
    const login = await request(app).post('/api/auth/login').send({ email: student.email, password: PASSWORD });
    expect(login.status).toBe(403);
  });

  it('returns the current user for /me via bearer token and via cookie', async () => {
    await createUser('STUDENT', 's@x.dev');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 's@x.dev', password: PASSWORD });
    const viaCookie = await agent.get('/api/auth/me');
    expect(viaCookie.status).toBe(200);
    expect(viaCookie.body.data.user.email).toBe('s@x.dev');
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects requests without a token, with a garbage token, and with a forged token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer('garbage'))).status).toBe(401);
    const user = await createUser('ADMIN', 'a@x.dev');
    const forged = jwt.sign({ sub: user.id, role: 'ADMIN' }, 'some-other-secret-value-1234');
    expect((await request(app).get('/api/auth/me').set(bearer(forged))).status).toBe(401);
  });

  it('is not vulnerable to NoSQL operator injection on login', async () => {
    await createUser('ADMIN', 'a@x.dev');
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});

describe('RBAC: user management', () => {
  it('lets an admin list, create, and update users', async () => {
    const { adminToken, student } = await seedRoles(app);
    const list = await request(app).get('/api/users?limit=2').set(bearer(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 2, total: 3 });
    const create = await request(app).post('/api/users').set(bearer(adminToken))
      .send({ name: 'New Faculty', email: 'nf@x.dev', password: 'Abcdef12', role: 'FACULTY' });
    expect(create.status).toBe(201);
    expect(create.body.data.role).toBe('FACULTY');
    const upd = await request(app).put(`/api/users/${student.id}`).set(bearer(adminToken)).send({ name: 'Renamed Student' });
    expect(upd.body.data.name).toBe('Renamed Student');
  });

  it('forbids students and faculty from managing users (403) and logs the attempt', async () => {
    const { studentToken, facultyToken, student } = await seedRoles(app);
    for (const t of [studentToken, facultyToken]) {
      expect((await request(app).get('/api/users').set(bearer(t))).status).toBe(403);
      expect((await request(app).post('/api/users').set(bearer(t)).send({})).status).toBe(403);
      expect((await request(app).patch(`/api/users/${student.id}/role`).set(bearer(t)).send({ role: 'ADMIN' })).status).toBe(403);
      expect((await request(app).patch(`/api/users/${student.id}/status`).set(bearer(t)).send({ isActive: false })).status).toBe(403);
    }
    expect(await AuditLog.countDocuments({ action: 'UNAUTHORIZED_ACCESS', outcome: 'DENIED' })).toBeGreaterThanOrEqual(8);
  });

  it('prevents users from privilege escalation via profile update', async () => {
    const { student, studentToken } = await seedRoles(app);
    const res = await request(app).put(`/api/users/${student.id}`).set(bearer(studentToken)).send({ role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect((await User.findById(student.id))!.role).toBe('STUDENT');
    const own = await request(app).put(`/api/users/${student.id}`).set(bearer(studentToken)).send({ institution: 'NLU Delhi' });
    expect(own.status).toBe(200);
  });

  it('prevents reading or editing other users profiles unless admin', async () => {
    const { faculty, student, studentToken, adminToken } = await seedRoles(app);
    expect((await request(app).get(`/api/users/${faculty.id}`).set(bearer(studentToken))).status).toBe(403);
    expect((await request(app).put(`/api/users/${faculty.id}`).set(bearer(studentToken)).send({ name: 'Hacked' })).status).toBe(403);
    expect((await request(app).get(`/api/users/${student.id}`).set(bearer(studentToken))).status).toBe(200);
    expect((await request(app).get(`/api/users/${faculty.id}`).set(bearer(adminToken))).status).toBe(200);
  });

  it('changes roles immediately and audits it; admins cannot demote themselves or the last admin', async () => {
    const { admin, student, adminToken, studentToken } = await seedRoles(app);
    const res = await request(app).patch(`/api/users/${student.id}/role`).set(bearer(adminToken)).send({ role: 'FACULTY' });
    expect(res.status).toBe(200);
    // The old token reflects the new role at once because role is read from the DB.
    expect((await request(app).get('/api/users').set(bearer(studentToken))).status).toBe(403);
    const log = await AuditLog.findOne({ action: 'USER_ROLE_CHANGED' });
    expect(log!.metadata).toMatchObject({ from: 'STUDENT', to: 'FACULTY' });
    const self = await request(app).patch(`/api/users/${admin.id}/role`).set(bearer(adminToken)).send({ role: 'STUDENT' });
    expect(self.status).toBe(403);
    const other = await createUser('ADMIN', 'admin2@test.dev');
    const otherToken = await loginAs(app, other.email);
    // admin2 demoting admin1 is fine because admin2 remains; then admin1 can no longer act.
    const demote = await request(app).patch(`/api/users/${admin.id}/role`).set(bearer(otherToken)).send({ role: 'FACULTY' });
    expect(demote.status).toBe(200);
  });

  it('rejects malformed ids with 400 and unknown users with 404', async () => {
    const { adminToken } = await seedRoles(app);
    expect((await request(app).get('/api/users/not-an-id').set(bearer(adminToken))).status).toBe(400);
    expect((await request(app).get('/api/users/64b64b64b64b64b64b64b64b').set(bearer(adminToken))).status).toBe(404);
  });
});
