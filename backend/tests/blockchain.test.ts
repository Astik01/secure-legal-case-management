import fs from 'fs';
import request from 'supertest';
import { HDNodeWallet, JsonRpcProvider, Mnemonic, Network, Wallet, parseEther } from 'ethers';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { AuditLog } from '../src/models/AuditLog';
import { ethers } from 'ethers';
import { DocumentModel } from '../src/models/Document';
import { BlockchainRecord } from '../src/models/BlockchainRecord';
import { DocumentVersion } from '../src/models/DocumentVersion';
import { BlockchainService, getBlockchain, setBlockchain, uploaderRefFor } from '../src/services/blockchain.service';
import { sha256Hex } from '../src/utils/file';
import { bearer, clearCollections, createUser, loginAs, seedRoles, startTestDb, stopTestDb } from './helpers';
import { makePdf } from './pdf';

const app = createApp();
beforeAll(() => startTestDb('blockchain'));
afterAll(() => stopTestDb());
beforeEach(async () => {
  setBlockchain(undefined);
  await clearCollections();
});

const casePayload = {
  title: 'Vishaka v. State of Rajasthan', caseNumber: 'WP 666/1992', court: 'Supreme Court of India',
  year: 1997, category: 'Human Rights', summary: 'Laid down guidelines on sexual harassment at the workplace.',
};

async function setup() {
  const roles = await seedRoles(app);
  const c = (await request(app).post('/api/cases').set(bearer(roles.facultyToken)).send(casePayload)).body.data;
  return { ...roles, caseId: c._id as string };
}
const upload = (token: string, caseId: string, pdf: Buffer, documentId?: string) => {
  let r = request(app).post('/api/documents/upload').set(bearer(token)).field('caseId', caseId);
  if (documentId) r = r.field('documentId', documentId);
  return r.attach('file', pdf, { filename: 'judgment.pdf', contentType: 'application/pdf' });
};

describe('Blockchain registration', () => {
  it('registers an uploaded document and stores tx hash and block number once confirmed', async () => {
    const { facultyToken, caseId, faculty } = await setup();
    const pdf = await makePdf('v1');
    const res = await upload(facultyToken, caseId, pdf);
    expect(res.status).toBe(201);
    const chain = res.body.data.blockchain;
    expect(chain.status).toBe('CONFIRMED');
    expect(chain.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(chain.blockNumber).toBeGreaterThan(0);
    expect(chain.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

    // Read the chain directly: the registered hash is the SHA-256 of the file bytes.
    const onChain = await getBlockchain().readVersion(res.body.data.document.documentKey, 1);
    expect(onChain.registered).toBe(true);
    expect(onChain.record!.contentHash).toBe(`0x${sha256Hex(pdf)}`);
    expect(onChain.record!.uploaderRef).toBe(uploaderRefFor(faculty.id));
    expect(onChain.record!.timestamp).toBeGreaterThan(0);
    expect(await AuditLog.countDocuments({ action: 'BLOCKCHAIN_REGISTERED' })).toBe(1);
  });

  it('registers new versions append-only and keeps earlier hashes', async () => {
    const { facultyToken, caseId } = await setup();
    const v1 = await makePdf('one');
    const first = await upload(facultyToken, caseId, v1);
    const docId = first.body.data.document._id;
    const v2 = await makePdf('two');
    const second = await upload(facultyToken, caseId, v2, docId);
    expect(second.body.data.blockchain).toMatchObject({ version: 2, status: 'CONFIRMED' });
    const key = first.body.data.document.documentKey;
    const svc = getBlockchain();
    expect((await svc.readVersion(key, 1)).record!.contentHash).toBe(`0x${sha256Hex(v1)}`);
    expect((await svc.readVersion(key, 2)).record!.contentHash).toBe(`0x${sha256Hex(v2)}`);
    expect((await svc.readVersion(key, 2)).versionCount).toBe(2);
  });

  it('is idempotent: re-registering confirmed versions sends no new transaction', async () => {
    const { facultyToken, caseId } = await setup();
    const up = await upload(facultyToken, caseId, await makePdf('idem'));
    const docId = up.body.data.document._id;
    const before = await BlockchainRecord.findOne({ document: docId });
    const again = await request(app).post('/api/blockchain/register').set(bearer(facultyToken)).send({ documentId: docId });
    expect(again.status).toBe(200);
    expect(again.body.data[0].txHash).toBe(before!.txHash);
    expect(await BlockchainRecord.countDocuments({ document: docId })).toBe(1);
    expect((await getBlockchain().readVersion(up.body.data.document.documentKey, 1)).versionCount).toBe(1);
  });

  it('re-registers when the database says CONFIRMED but the chain has no such record (e.g. chain reset)', async () => {
    const { facultyToken, caseId } = await setup();
    const pdf = await makePdf('chain-reset');
    const up = await upload(facultyToken, caseId, pdf);
    const docId = up.body.data.document._id;
    const oldTx = up.body.data.blockchain.txHash;
    // Simulate a wiped chain: point the document at an identifier the chain has never seen.
    const fresh = ethers.id(`never-registered-${Date.now()}`);
    await DocumentModel.updateOne({ _id: docId }, { documentKey: fresh });
    await BlockchainRecord.updateOne({ document: docId }, { documentKey: fresh });
    expect((await getBlockchain().readVersion(fresh, 1)).registered).toBe(false);

    const res = await request(app).post('/api/blockchain/register').set(bearer(facultyToken)).send({ documentId: docId });
    expect(res.body.data[0].status).toBe('CONFIRMED');
    expect(res.body.data[0].txHash).not.toBe(oldTx);
    const onChain = await getBlockchain().readVersion(fresh, 1);
    expect(onChain.registered).toBe(true);
    expect(onChain.record!.contentHash).toBe(`0x${sha256Hex(pdf)}`);
  });

  it('keeps the upload and marks registration FAILED when the chain is unreachable, then recovers on retry', async () => {
    const { facultyToken, caseId } = await setup();
    setBlockchain(new BlockchainService({
      rpcUrl: 'http://127.0.0.1:1', deploymentFile: env.deploymentFile, privateKey: env.BLOCKCHAIN_PRIVATE_KEY,
    }));
    const pdf = await makePdf('offline');
    const up = await upload(facultyToken, caseId, pdf);
    expect(up.status).toBe(201);
    expect(up.body.data.blockchain.status).toBe('FAILED');
    expect(up.body.data.blockchain.confirmedAt).toBeUndefined();
    expect(await AuditLog.countDocuments({ action: 'BLOCKCHAIN_REGISTRATION_FAILED' })).toBe(1);

    setBlockchain(undefined); // chain is back
    const retry = await request(app).post('/api/blockchain/register').set(bearer(facultyToken))
      .send({ documentId: up.body.data.document._id });
    expect(retry.body.data[0]).toMatchObject({ status: 'CONFIRMED', version: 1 });
    expect(retry.body.data[0].error).toBeUndefined();
  });

  it('prevents an unauthorized signer from registering and records the failure', async () => {
    const { facultyToken, caseId } = await setup();
    const stranger = HDNodeWallet.fromMnemonic(
      Mnemonic.fromPhrase('test test test test test test test test test test test junk'), "m/44'/60'/0'/0/7",
    );
    // Fund the stranger so the failure comes from the contract access check, not from missing gas.
    const provider = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL, 31337, { staticNetwork: Network.from(31337) });
    const funder = new Wallet(env.BLOCKCHAIN_PRIVATE_KEY!, provider);
    await (await funder.sendTransaction({ to: stranger.address, value: parseEther('1') })).wait();
    provider.destroy();
    setBlockchain(new BlockchainService({
      rpcUrl: env.BLOCKCHAIN_RPC_URL, deploymentFile: env.deploymentFile, privateKey: stranger.privateKey,
    }));
    const up = await upload(facultyToken, caseId, await makePdf('unauthorised'));
    expect(up.body.data.blockchain.status).toBe('FAILED');
    expect(up.body.data.blockchain.error).toMatch(/NotRegistrar/);
    const onChain = await getBlockchain().readVersion(up.body.data.document.documentKey, 1);
    expect(onChain.registered).toBe(false);
  });

  it('reports the missing signer configuration without crashing', async () => {
    const { facultyToken, caseId } = await setup();
    setBlockchain(new BlockchainService({ rpcUrl: env.BLOCKCHAIN_RPC_URL, deploymentFile: env.deploymentFile }));
    const up = await upload(facultyToken, caseId, await makePdf('nokey'));
    expect(up.status).toBe(201);
    expect(up.body.data.blockchain.error).toMatch(/PRIVATE_KEY/);
  });

  it('exposes records with RBAC: students read via document, only admin lists all, status for staff', async () => {
    const { facultyToken, adminToken, studentToken, caseId } = await setup();
    const up = await upload(facultyToken, caseId, await makePdf('rbac'));
    const docId = up.body.data.document._id;
    // Unpublished case: student cannot see the document at all.
    expect((await request(app).get(`/api/blockchain/records/${docId}`).set(bearer(studentToken))).status).toBe(404);
    await request(app).patch(`/api/cases/${caseId}/submit`).set(bearer(facultyToken));
    await request(app).patch(`/api/cases/${caseId}/approve`).set(bearer(adminToken)).send({ decision: 'APPROVE' });
    const rec = await request(app).get(`/api/blockchain/records/${docId}`).set(bearer(studentToken));
    expect(rec.status).toBe(200);
    expect(rec.body.data[0].status).toBe('CONFIRMED');

    expect((await request(app).get('/api/blockchain/records').set(bearer(studentToken))).status).toBe(403);
    expect((await request(app).get('/api/blockchain/records').set(bearer(facultyToken))).status).toBe(403);
    expect((await request(app).get('/api/blockchain/records?status=CONFIRMED').set(bearer(adminToken))).body.meta.total).toBe(1);
    expect((await request(app).post('/api/blockchain/register').set(bearer(studentToken)).send({ documentId: docId })).status).toBe(403);
    const other = await createUser('FACULTY', 'other@test.dev');
    const otherToken = await loginAs(app, other.email);
    expect((await request(app).post('/api/blockchain/register').set(bearer(otherToken)).send({ documentId: docId })).status).toBe(403);

    const status = await request(app).get('/api/blockchain/status').set(bearer(adminToken));
    expect(status.body.data).toMatchObject({ connected: true, registrarAuthorized: true, chainId: 31337 });
    expect(JSON.stringify(status.body)).not.toMatch(/privateKey|0xac0974/i);
    expect((await request(app).get('/api/blockchain/status').set(bearer(studentToken))).status).toBe(403);
  });

  it('never stores the file or personal data on-chain, only hashes and an opaque uploader reference', async () => {
    const { facultyToken, caseId, faculty } = await setup();
    const up = await upload(facultyToken, caseId, await makePdf('privacy'));
    const rec = (await getBlockchain().readVersion(up.body.data.document.documentKey, 1)).record!;
    expect(rec.uploaderRef).not.toContain(faculty.id);
    expect(rec.uploaderRef).toMatch(/^0x[a-f0-9]{64}$/);
    expect(fs.existsSync(env.deploymentFile)).toBe(true);
    expect(await DocumentVersion.countDocuments()).toBe(1);
  });
});
