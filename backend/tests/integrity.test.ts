import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { AuditLog } from '../src/models/AuditLog';
import { DocumentVersion } from '../src/models/DocumentVersion';
import { BlockchainService, setBlockchain } from '../src/services/blockchain.service';
import { sha256Hex } from '../src/utils/file';
import { bearer, clearCollections, seedRoles, startTestDb, stopTestDb } from './helpers';
import { makePdf } from './pdf';

const app = createApp();
beforeAll(() => startTestDb('integrity'));
afterAll(() => stopTestDb());
beforeEach(async () => {
  setBlockchain(undefined);
  await clearCollections();
});

const casePayload = {
  title: 'Justice K.S. Puttaswamy v. Union of India', caseNumber: 'WP 494/2012', court: 'Supreme Court of India',
  year: 2017, category: 'Constitutional Law', summary: 'Recognised the right to privacy as a fundamental right under Article 21.',
};

async function setup(publish = true) {
  const roles = await seedRoles(app);
  const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
  if (publish) {
    await request(app).patch(`/api/cases/${c._id}/submit`).set(bearer(roles.facultyToken));
    await request(app).patch(`/api/cases/${c._id}/approve`).set(bearer(roles.adminToken)).send({ decision: 'APPROVE' });
  }
  return { ...roles, caseId: c._id as string };
}
const upload = (token: string, caseId: string, pdf: Buffer, documentId?: string) => {
  let r = request(app).post('/api/documents/upload').set(bearer(token)).field('caseId', caseId);
  if (documentId) r = r.field('documentId', documentId);
  return r.attach('file', pdf, { filename: 'judgment.pdf', contentType: 'application/pdf' });
};
const verify = (token: string, docId: string, qs = '') => request(app).get(`/api/blockchain/verify/${docId}${qs}`).set(bearer(token));
const storedPath = async (docId: string, version = 1) =>
  path.join(env.storageDir, (await DocumentVersion.findOne({ document: docId, version }))!.storageKey);

describe('Integrity verification (end to end)', () => {
  it('upload -> register -> retrieve -> verify -> tamper -> verification fails', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    const pdf = await makePdf('original judgment');
    const up = await upload(facultyToken, caseId, pdf);
    const docId = up.body.data.document._id;
    expect(up.body.data.blockchain.status).toBe('CONFIRMED');

    // Retrieval returns the identical bytes.
    const dl = await request(app).get(`/api/documents/${docId}/download`).set(bearer(studentToken))
      .buffer(true).parse((res, cb) => { const ch: Buffer[] = []; res.on('data', (d: Buffer) => ch.push(d)); res.on('end', () => cb(null, Buffer.concat(ch))); });
    expect(sha256Hex(dl.body as Buffer)).toBe(sha256Hex(pdf));

    const ok = await verify(studentToken, docId);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      status: 'VERIFIED', version: 1, source: 'STORED_FILE',
      originalHash: `0x${sha256Hex(pdf)}`, currentHash: `0x${sha256Hex(pdf)}`,
    });
    expect(ok.body.data.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(ok.body.data.blockNumber).toBeGreaterThan(0);
    expect(ok.body.data.registeredAt).toBeTruthy();

    // Modify the stored file (simulates tampering on the server).
    const file = await storedPath(docId);
    const tampered = Buffer.from(pdf);
    tampered[tampered.length - 20] ^= 0xff;
    fs.writeFileSync(file, tampered);

    const bad = await verify(studentToken, docId);
    expect(bad.body.data.status).toBe('TAMPERED');
    expect(bad.body.data.originalHash).toBe(`0x${sha256Hex(pdf)}`);
    expect(bad.body.data.currentHash).toBe(`0x${sha256Hex(tampered)}`);
    expect(bad.body.data.originalHash).not.toBe(bad.body.data.currentHash);

    expect(await AuditLog.countDocuments({ action: 'DOCUMENT_VERIFIED', outcome: 'SUCCESS' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'DOCUMENT_VERIFIED', outcome: 'FAILURE' })).toBe(1);
  });

  it('still detects tampering when the database hash is also falsified (the chain is authoritative)', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    const pdf = await makePdf('db-attack');
    const docId = (await upload(facultyToken, caseId, pdf)).body.data.document._id;
    const forged = Buffer.concat([pdf.subarray(0, pdf.length - 10), Buffer.from('FORGED'), pdf.subarray(pdf.length - 10)]);
    fs.writeFileSync(await storedPath(docId), forged);
    await DocumentVersion.updateOne({ document: docId, version: 1 }, { sha256: sha256Hex(forged) });
    const res = await verify(studentToken, docId);
    expect(res.body.data.status).toBe('TAMPERED');
    expect(res.body.data.databaseHash).toBe(sha256Hex(forged));
    expect(res.body.data.originalHash).toBe(`0x${sha256Hex(pdf)}`);
  });

  it('verifies each version independently and keeps history intact', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    const v1 = await makePdf('first');
    const v2 = await makePdf('second');
    const docId = (await upload(facultyToken, caseId, v1)).body.data.document._id;
    await upload(facultyToken, caseId, v2, docId);
    expect((await verify(studentToken, docId, '?version=1')).body.data).toMatchObject({ status: 'VERIFIED', version: 1 });
    expect((await verify(studentToken, docId)).body.data).toMatchObject({ status: 'VERIFIED', version: 2 });
    // Tampering v2 does not affect v1.
    fs.writeFileSync(await storedPath(docId, 2), Buffer.from('%PDF-1.4 tampered %%EOF'));
    expect((await verify(studentToken, docId, '?version=1')).body.data.status).toBe('VERIFIED');
    expect((await verify(studentToken, docId, '?version=2')).body.data.status).toBe('TAMPERED');
    expect((await verify(studentToken, docId, '?version=9')).status).toBe(404);
  });

  it('returns NOT_REGISTERED when the hash never reached the chain', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    setBlockchain(new BlockchainService({ rpcUrl: 'http://127.0.0.1:1', deploymentFile: env.deploymentFile, privateKey: env.BLOCKCHAIN_PRIVATE_KEY }));
    const up = await upload(facultyToken, caseId, await makePdf('unregistered'));
    expect(up.body.data.blockchain.status).toBe('FAILED');
    setBlockchain(undefined); // chain reachable again, but nothing was registered
    const res = await verify(studentToken, up.body.data.document._id);
    expect(res.body.data.status).toBe('NOT_REGISTERED');
    expect(res.body.data.originalHash).toBeNull();
  });

  it('returns VERIFICATION_ERROR (never VERIFIED) when the blockchain cannot be reached', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    const up = await upload(facultyToken, caseId, await makePdf('outage'));
    setBlockchain(new BlockchainService({ rpcUrl: 'http://127.0.0.1:1', deploymentFile: env.deploymentFile, privateKey: env.BLOCKCHAIN_PRIVATE_KEY }));
    const res = await verify(studentToken, up.body.data.document._id);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('VERIFICATION_ERROR');
    expect(res.body.data.message).toMatch(/could not be completed/i);
  });

  it('returns VERIFICATION_ERROR when the stored file is missing', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    const docId = (await upload(facultyToken, caseId, await makePdf('gone'))).body.data.document._id;
    fs.unlinkSync(await storedPath(docId));
    expect((await verify(studentToken, docId)).body.data.status).toBe('VERIFICATION_ERROR');
  });

  it('verifies a user-supplied copy: identical copy passes, a modified copy is TAMPERED', async () => {
    const { facultyToken, studentToken, caseId } = await setup();
    const pdf = await makePdf('copy-check');
    const docId = (await upload(facultyToken, caseId, pdf)).body.data.document._id;
    const send = (buf: Buffer) => request(app).post(`/api/blockchain/verify/${docId}/file`).set(bearer(studentToken))
      .attach('file', buf, { filename: 'copy.pdf', contentType: 'application/pdf' });
    const same = await send(pdf);
    expect(same.body.data).toMatchObject({ status: 'VERIFIED', source: 'UPLOADED_COPY' });
    const modified = await send(await makePdf('copy-check but edited'));
    expect(modified.body.data.status).toBe('TAMPERED');
    expect((await request(app).post(`/api/blockchain/verify/${docId}/file`).set(bearer(studentToken))).status).toBe(400);
  });

  it('enforces access: unpublished documents are hidden from students, verification needs authentication', async () => {
    const { facultyToken, studentToken, caseId } = await setup(false);
    const docId = (await upload(facultyToken, caseId, await makePdf('draft'))).body.data.document._id;
    expect((await verify(studentToken, docId)).status).toBe(404);
    expect((await verify(facultyToken, docId)).body.data.status).toBe('VERIFIED');
    expect((await request(app).get(`/api/blockchain/verify/${docId}`)).status).toBe(401);
    expect((await request(app).get('/api/blockchain/verify/not-an-id').set(bearer(studentToken))).status).toBe(400);
  });

  it('scopes verification history by role', async () => {
    const { facultyToken, studentToken, adminToken, caseId } = await setup();
    const docId = (await upload(facultyToken, caseId, await makePdf('history'))).body.data.document._id;
    await verify(studentToken, docId);
    await verify(facultyToken, docId);
    const get = async (t: string, qs = '') => (await request(app).get(`/api/blockchain/verifications${qs}`).set(bearer(t))).body;
    expect((await get(studentToken)).meta.total).toBe(1);
    expect((await get(facultyToken)).meta.total).toBe(2);
    expect((await get(adminToken)).meta.total).toBe(2);
    fs.writeFileSync(await storedPath(docId), Buffer.from('%PDF-1.4 x %%EOF'));
    await verify(adminToken, docId);
    expect((await get(adminToken, '?status=TAMPERED')).meta.total).toBe(1);
    expect((await get(studentToken)).meta.total).toBe(1);
  });
});
