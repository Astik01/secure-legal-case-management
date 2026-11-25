import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { AuditLog } from '../src/models/AuditLog';
import { DocumentModel } from '../src/models/Document';
import { DocumentVersion } from '../src/models/DocumentVersion';
import { sha256Hex } from '../src/utils/file';
import { bearer, clearCollections, createUser, loginAs, seedRoles, startTestDb, stopTestDb } from './helpers';
import { makePdf } from './pdf';

const app = createApp();
beforeAll(() => startTestDb('documents'));
afterAll(() => stopTestDb());
beforeEach(() => clearCollections());

const casePayload = {
  title: 'Shreya Singhal v. Union of India', caseNumber: 'WP 167/2012', court: 'Supreme Court of India',
  year: 2015, category: 'Constitutional Law', summary: 'Struck down Section 66A of the IT Act as unconstitutional.',
};

async function publishedCase(roles: Awaited<ReturnType<typeof seedRoles>>) {
  const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
  await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(roles.facultyToken));
  await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(roles.adminToken)).send({ decision: 'APPROVE' });
  return c;
}

const upload = (token: string, caseId: string, pdf: Buffer, extra: Record<string, string> = {}, name = 'judgment.pdf') => {
  let r = request(app).post('/api/documents/upload').set(bearer(token)).field('caseId', caseId);
  for (const [k, v] of Object.entries(extra)) r = r.field(k, v);
  return r.attach('file', pdf, { filename: name, contentType: 'application/pdf' });
};

describe('Document upload', () => {
  it('stores a PDF privately, records its SHA-256 and audits it', async () => {
    const roles = await seedRoles(app);
    const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
    const pdf = await makePdf('v1');
    const res = await upload(roles.facultyToken, c._id, pdf);
    expect(res.status).toBe(201);
    const { document, version } = res.body.data;
    expect(version.sha256).toBe(sha256Hex(pdf));
    expect(version.version).toBe(1);
    expect(document.documentKey).toMatch(/^0x[a-f0-9]{64}$/);
    const stored = await DocumentVersion.findOne({ document: document._id });
    expect(fs.readFileSync(path.join(env.storageDir, stored!.storageKey)).equals(pdf)).toBe(true);
    expect(await AuditLog.countDocuments({ action: 'DOCUMENT_UPLOADED' })).toBe(1);
  });

  it('forbids students, and faculty uploading to someone else case', async () => {
    const roles = await seedRoles(app);
    const c = await publishedCase(roles);
    const pdf = await makePdf('x');
    expect((await upload(roles.studentToken, c._id, pdf)).status).toBe(403);
    const other = await createUser('FACULTY', 'other@test.dev');
    const otherToken = await loginAs(app, other.email);
    expect((await upload(otherToken, c._id, pdf)).status).toBe(403);
    expect((await upload(roles.adminToken, c._id, pdf)).status).toBe(201);
  });

  it('rejects non-PDF content disguised as a PDF, wrong types, and oversize files', async () => {
    const roles = await seedRoles(app);
    const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
    const fake = await upload(roles.facultyToken, c._id, Buffer.from('<script>alert(1)</script> not a pdf at all'));
    expect(fake.status).toBe(400);
    const wrongMime = await request(app).post('/api/documents/upload').set(bearer(roles.facultyToken))
      .field('caseId', c._id).attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(wrongMime.status).toBe(415);
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(env.maxUploadBytes + 10), Buffer.from('%%EOF')]);
    expect((await upload(roles.facultyToken, c._id, big)).status).toBe(413);
    expect((await request(app).post('/api/documents/upload').set(bearer(roles.facultyToken)).field('caseId', c._id)).status).toBe(400);
    expect(await DocumentModel.countDocuments()).toBe(0);
  });

  it('sanitises hostile file names and never uses them for storage paths', async () => {
    const roles = await seedRoles(app);
    const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
    const res = await upload(roles.facultyToken, c._id, await makePdf('n'), {}, '..\\..\\evil"; name=<x>.pdf');
    expect(res.status).toBe(201);
    expect(res.body.data.version.safeName).toMatch(/^[\w.\- ]+\.pdf$/);
    const stored = await DocumentVersion.findOne();
    expect(stored!.storageKey).not.toMatch(/evil/);
    expect(stored!.storageKey).not.toContain('..');
  });

  it('creates immutable versions and rejects an identical re-upload', async () => {
    const roles = await seedRoles(app);
    const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
    const v1 = await makePdf('first');
    const first = await upload(roles.facultyToken, c._id, v1);
    const docId = first.body.data.document._id;
    const v2 = await makePdf('second');
    const second = await upload(roles.facultyToken, c._id, v2, { documentId: docId });
    expect(second.status).toBe(201);
    expect(second.body.data.version.version).toBe(2);
    expect((await upload(roles.facultyToken, c._id, v2, { documentId: docId })).status).toBe(409);

    const versions = await request(app).get(`/api/documents/${docId}/versions`).set(bearer(roles.facultyToken));
    expect(versions.body.data.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(versions.body.data[0].sha256).toBe(sha256Hex(v1));
    expect(versions.body.data[1].sha256).toBe(sha256Hex(v2));
    expect(await AuditLog.countDocuments({ action: 'DOCUMENT_VERSION_CREATED' })).toBe(1);
    // The v1 file is untouched on disk.
    const v1Row = await DocumentVersion.findOne({ document: docId, version: 1 });
    expect(sha256Hex(fs.readFileSync(path.join(env.storageDir, v1Row!.storageKey)))).toBe(sha256Hex(v1));
  });
});

describe('Document access', () => {
  it('lets students download documents of published cases only, with safe headers', async () => {
    const roles = await seedRoles(app);
    const draft = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
    const pdf = await makePdf('private');
    const up = await upload(roles.facultyToken, draft._id, pdf);
    const docId = up.body.data.document._id;

    expect((await request(app).get(`/api/documents/${docId}/download`).set(bearer(roles.studentToken))).status).toBe(404);
    expect((await request(app).get(`/api/documents?caseId=${draft._id}`).set(bearer(roles.studentToken))).status).toBe(404);

    await request(app).patch(`/api/cases/${draft._id}/submit`).set(bearer(roles.facultyToken));
    await request(app).patch(`/api/cases/${draft._id}/approve`).set(bearer(roles.adminToken)).send({ decision: 'APPROVE' });

    const dl = await request(app).get(`/api/documents/${docId}/download?inline=true`).set(bearer(roles.studentToken)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toBe('application/pdf');
    expect(dl.headers['content-disposition']).toMatch(/^inline; filename=/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    expect(dl.headers['cache-control']).toMatch(/no-store/);
    expect(sha256Hex(dl.body as Buffer)).toBe(sha256Hex(pdf));
    expect(await AuditLog.countDocuments({ action: 'DOCUMENT_DOWNLOADED' })).toBe(1);

    const list = await request(app).get(`/api/documents?caseId=${draft._id}`).set(bearer(roles.studentToken));
    expect(list.body.data[0].current.version).toBe(1);
  });

  it('requires authentication and does not expose storage over static routes', async () => {
    const roles = await seedRoles(app);
    const c = await publishedCase(roles);
    const up = await upload(roles.facultyToken, c._id, await makePdf('s'));
    expect((await request(app).get(`/api/documents/${up.body.data.document._id}/download`)).status).toBe(401);
    const stored = await DocumentVersion.findOne();
    expect((await request(app).get(`/storage/${stored!.storageKey}`)).status).toBe(404);
    expect((await request(app).get(`/uploads/${stored!.storageKey}`)).status).toBe(404);
  });
});
