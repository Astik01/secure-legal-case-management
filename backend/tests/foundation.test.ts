import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDb, disconnectDb } from '../src/config/db';
import { User } from '../src/models/User';
import { AuditLog } from '../src/models/AuditLog';
import { LegalCase } from '../src/models/LegalCase';

const app = createApp();

beforeAll(async () => {
  await connectDb(`${process.env.MONGODB_URI}foundation`);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('API foundation', () => {
  it('health endpoint reports database connectivity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok', database: 'connected' } });
  });

  it('returns a consistent JSON error for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('Models', () => {
  it('never serializes the password hash', async () => {
    const u = await User.create({ name: 'Test User', email: 'A@B.com', passwordHash: 'hash', role: 'STUDENT' });
    expect(u.email).toBe('a@b.com');
    expect(JSON.parse(JSON.stringify(u)).passwordHash).toBeUndefined();
    const fetched = await User.findById(u._id);
    expect(fetched?.passwordHash).toBeUndefined();
  });

  it('enforces unique email and case number', async () => {
    await expect(User.create({ name: 'Dup', email: 'a@b.com', passwordHash: 'h' })).rejects.toThrow(/duplicate key/);
    const base = {
      title: 'T', caseNumber: 'C-1', court: 'Supreme Court of India', year: 2000, category: 'Civil Law',
      summary: 'S', createdBy: new mongoose.Types.ObjectId(),
    };
    await LegalCase.create(base);
    await expect(LegalCase.create(base)).rejects.toThrow(/duplicate key/);
  });

  it('audit log entries cannot be updated or deleted', async () => {
    const entry = await AuditLog.create({ action: 'TEST', outcome: 'SUCCESS' });
    await expect(AuditLog.updateOne({ _id: entry._id }, { action: 'X' })).rejects.toThrow(/append-only/);
    await expect(AuditLog.deleteOne({ _id: entry._id })).rejects.toThrow(/append-only/);
    await expect(AuditLog.deleteMany({})).rejects.toThrow(/append-only/);
    entry.action = 'CHANGED';
    await expect(entry.save()).rejects.toThrow(/append-only/);
    expect(await AuditLog.countDocuments({ action: 'TEST' })).toBe(1);
  });
});
