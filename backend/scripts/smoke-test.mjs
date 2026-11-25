/**
 * End-to-end smoke test against the RUNNING application (backend + MongoDB + Hardhat chain + seeded data).
 *
 *   npm run smoke            (from the repo root; API defaults to http://localhost:4000/api)
 *
 * It creates and removes its own case, and registers then deactivates one throw-away student account.
 * It never modifies the seeded demo documents.
 */
import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { PDFDocument } = createRequire(path.join(here, '../package.json'))('pdf-lib');
const storageRoot = path.resolve(here, '../storage');
const BASE = process.env.API_URL ?? 'http://localhost:4000/api';
const env = process.env;
const ADMIN = [env.SEED_ADMIN_EMAIL ?? 'admin@lawschool.test', env.SEED_ADMIN_PASSWORD ?? 'Admin@12345'];
const FACULTY = [env.SEED_FACULTY_EMAIL ?? 'faculty@lawschool.test', env.SEED_FACULTY_PASSWORD ?? 'Faculty@12345'];
const STUDENT = [env.SEED_STUDENT_EMAIL ?? 'student@lawschool.test', env.SEED_STUDENT_PASSWORD ?? 'Student@12345'];

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  ok ? passed++ : failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const section = (t) => console.log(`\n== ${t}`);

async function call(method, url, token, body, form) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  const raw = await res.arrayBuffer();
  let json = {};
  try { json = JSON.parse(Buffer.from(raw).toString('utf8')); } catch { /* binary body */ }
  return { status: res.status, headers: res.headers, raw: Buffer.from(raw), ...json };
}
const login = async ([email, password]) => (await call('POST', '/auth/login', null, { email, password })).data?.token;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
async function pdf(text) {
  const d = await PDFDocument.create();
  d.addPage([300, 200]).drawText(`SMOKE TEST DEMONSTRATION - ${text}`, { x: 10, y: 100, size: 9 });
  return Buffer.from(await d.save());
}
const upload = (token, caseId, buf, extra = {}, name = 'smoke.pdf', type = 'application/pdf') => {
  const f = new FormData();
  f.append('caseId', caseId);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  f.append('file', new Blob([buf], { type }), name);
  return call('POST', '/documents/upload', token, undefined, f);
};

const health = await call('GET', '/health').catch(() => ({}));
if (health.data?.status !== 'ok') { console.log('API not reachable at', BASE); process.exit(2); }
check('API health + database connected', health.data.database === 'connected');

const [admin, faculty, student] = [await login(ADMIN), await login(FACULTY), await login(STUDENT)];
check('seeded admin/faculty/student can sign in', Boolean(admin && faculty && student));
const status = await call('GET', '/blockchain/status', admin);
check('blockchain reachable, contract deployed, registrar authorized', status.data?.connected && status.data?.registrarAuthorized,
  `chain ${status.data?.chainId}, contract ${status.data?.contractAddress?.slice(0, 10)}...`);

section('Authentication');
const email = `smoke-${Date.now()}@lawschool.test`;
const goodPw = 'SmokeTest1';
const reg = await call('POST', '/auth/register', null, { name: 'Smoke Test Student', email, password: goodPw, role: 'ADMIN' });
check('registration succeeds and ignores a requested admin role', reg.status === 201 && reg.data.user.role === 'STUDENT');
check('duplicate registration is rejected (409)', (await call('POST', '/auth/register', null, { name: 'Dup Licate', email, password: goodPw })).status === 409);
check('weak password is rejected (400)', (await call('POST', '/auth/register', null, { name: 'Weak Pw', email: `w${email}`, password: 'abc' })).status === 400);
const smokeToken = await login([email, goodPw]);
check('login with valid credentials', Boolean(smokeToken));
check('login with a wrong password is rejected (401)', (await call('POST', '/auth/login', null, { email, password: 'WrongPass1' })).status === 401);
check('login with an unknown email is rejected (401)', (await call('POST', '/auth/login', null, { email: 'nobody@lawschool.test', password: 'WrongPass1' })).status === 401);
check('NoSQL operator injection on login is rejected (400)', (await call('POST', '/auth/login', null, { email: { $gt: '' }, password: { $gt: '' } })).status === 400);
check('protected route without a token (401)', (await call('GET', '/cases')).status === 401);
check('protected route with a garbage token (401)', (await call('GET', '/cases', 'garbage')).status === 401);
check('/auth/me returns the signed-in user', (await call('GET', '/auth/me', smokeToken)).data?.user?.email === email);
check('logout succeeds', (await call('POST', '/auth/logout', smokeToken)).status === 200);

section('Role-based access');
check('student cannot create a case (403)', (await call('POST', '/cases', student, { title: 'x' })).status === 403);
check('student cannot list users (403)', (await call('GET', '/users', student)).status === 403);
check('student cannot read the audit log (403)', (await call('GET', '/audit-logs', student)).status === 403);
check('student cannot upload documents (403)', (await upload(student, '64b64b64b64b64b64b64b64b', await pdf('x'))).status === 403);
check('faculty cannot list users (403)', (await call('GET', '/users', faculty)).status === 403);
check('faculty cannot approve cases (403)', (await call('PATCH', '/cases/64b64b64b64b64b64b64b64b/approve', faculty, { decision: 'APPROVE' })).status === 403);
check('faculty cannot change roles (403)', (await call('PATCH', '/users/64b64b64b64b64b64b64b64b/role', faculty, { role: 'ADMIN' })).status === 403);
check('admin can list users', (await call('GET', '/users', admin)).data?.length >= 3);
check('admin cannot change their own role (403)', (await call('PATCH', `/users/${(await call('GET', '/auth/me', admin)).data.user._id}/role`, admin, { role: 'STUDENT' })).status === 403);

section('Case management');
const list = await call('GET', '/cases?limit=50', student);
check('student sees only published cases', list.data.length >= 6 && list.data.every((c) => c.status === 'PUBLISHED'), `${list.meta.total} cases`);
const q = async (qs) => (await call('GET', `/cases?${qs}`, student)).meta.total;
check('search by title', (await q('title=maneka')) === 1);
check('search by case number', (await q('caseNumber=231')) >= 1);
check('filter by court', (await q('court=Supreme')) >= 6);
check('filter by year', (await q('year=1978')) === 1);
check('filter by category', (await q('category=Constitutional%20Law')) >= 4);
check('free-text search', (await q('q=privacy')) >= 1);
check('regex characters are treated as text', (await q('q=.*')) === 0);
const caseNo = `SMOKE-${Date.now()}`;
const created = await call('POST', '/cases', faculty, {
  title: 'Smoke test case', caseNumber: caseNo, court: 'Supreme Court of India', year: 2024, category: 'Other',
  summary: 'Temporary case created by the automated smoke test.',
});
check('faculty creates a case (DRAFT)', created.status === 201 && created.data.status === 'DRAFT');
const caseId = created.data._id;
check('invalid case data is rejected (400)', (await call('POST', '/cases', faculty, { title: 'x', year: 'abc' })).status === 400);
check('duplicate case number is rejected (409)', (await call('POST', '/cases', faculty, {
  title: 'Dup case', caseNumber: caseNo, court: 'Court', year: 2024, category: 'Other', summary: 'Duplicate number check.' })).status === 409);
check('student cannot see the draft (404)', (await call('GET', `/cases/${caseId}`, student)).status === 404);
const upd = await call('PUT', `/cases/${caseId}`, faculty, { title: 'Smoke test case (edited)' });
check('faculty updates own case', upd.data?.title === 'Smoke test case (edited)');
check('mass assignment of status is rejected (400)', (await call('PUT', `/cases/${caseId}`, faculty, { status: 'PUBLISHED' })).status === 400);
check('faculty submits for approval', (await call('PATCH', `/cases/${caseId}/submit`, faculty)).data?.status === 'PENDING');
check('reject requires a note (400)', (await call('PATCH', `/cases/${caseId}/approve`, admin, { decision: 'REJECT' })).status === 400);
check('admin approves and publishes', (await call('PATCH', `/cases/${caseId}/approve`, admin, { decision: 'APPROVE' })).data?.status === 'PUBLISHED');
check('student can now see the case', (await call('GET', `/cases/${caseId}`, student)).status === 200);
const bm = await call('POST', '/bookmarks', student, { caseId });
check('student bookmarks the case', bm.status === 201);
check('bookmark appears in the list', (await call('GET', '/bookmarks', student)).data.some((b) => b.legalCase._id === caseId));
check('student removes the bookmark', (await call('DELETE', `/bookmarks/${bm.data._id}`, student)).status === 200);

section('Document management');
const v1 = await pdf('version one');
const up1 = await upload(faculty, caseId, v1);
check('faculty uploads a PDF', up1.status === 201);
const docId = up1.data.document._id;
check('SHA-256 stored equals the SHA-256 of the file', up1.data.version.sha256 === sha(v1));
check('non-PDF content with a .pdf name is rejected (400)', (await upload(faculty, caseId, Buffer.from('<html>not a pdf</html>'))).status === 400);
check('wrong MIME type is rejected (415)', (await upload(faculty, caseId, Buffer.from('hello'), {}, 'a.txt', 'text/plain')).status === 415);
const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024), Buffer.from('%%EOF')]);
check('file over the size limit is rejected (413)', (await upload(faculty, caseId, big)).status === 413);
const v2 = await pdf('version two');
const up2 = await upload(faculty, caseId, v2, { documentId: docId });
check('faculty uploads version 2', up2.status === 201 && up2.data.version.version === 2);
check('identical re-upload is rejected (409)', (await upload(faculty, caseId, v2, { documentId: docId })).status === 409);
const versions = await call('GET', `/documents/${docId}/versions`, student);
check('version history lists v1 and v2 with their hashes', versions.data?.length === 2 && versions.data[0].sha256 === sha(v1) && versions.data[1].sha256 === sha(v2));
const dl = await call('GET', `/documents/${docId}/download?version=1`, student);
check('student downloads v1 with the exact bytes', dl.status === 200 && dl.headers.get('content-type') === 'application/pdf' && sha(dl.raw) === sha(v1));
check('download headers are safe', dl.headers.get('x-content-type-options') === 'nosniff' && /no-store/.test(dl.headers.get('cache-control')));
check('download requires authentication (401)', (await call('GET', `/documents/${docId}/download`)).status === 401);

section('Blockchain');
check('upload registered on-chain (CONFIRMED with tx hash and block)', up1.data.blockchain.status === 'CONFIRMED' && /^0x[a-f0-9]{64}$/.test(up1.data.blockchain.txHash) && up1.data.blockchain.blockNumber > 0,
  `block ${up1.data.blockchain.blockNumber}`);
check('version 2 registered on-chain', up2.data.blockchain.status === 'CONFIRMED' && up2.data.blockchain.version === 2);
const rec = await call('GET', `/blockchain/records/${docId}`, student);
check('blockchain records list both versions', rec.data?.length === 2 && rec.data.every((r) => r.status === 'CONFIRMED'));
const ver1 = await call('GET', `/blockchain/verify/${docId}?version=1`, student);
check('verify v1 = VERIFIED with matching on-chain and current hash', ver1.data?.status === 'VERIFIED' && ver1.data.originalHash === `0x${sha(v1)}` && ver1.data.currentHash === ver1.data.originalHash);
check('verify v2 (default) = VERIFIED', (await call('GET', `/blockchain/verify/${docId}`, student)).data?.status === 'VERIFIED');
check('verify an identical user copy = VERIFIED', (await (async () => {
  const f = new FormData(); f.append('file', new Blob([v1], { type: 'application/pdf' }), 'copy.pdf');
  return (await call('POST', `/blockchain/verify/${docId}/file?version=1`, student, undefined, f)).data?.status;
})()) === 'VERIFIED');
check('verify a modified user copy = TAMPERED', (await (async () => {
  const f = new FormData(); f.append('file', new Blob([await pdf('altered')], { type: 'application/pdf' }), 'copy.pdf');
  return (await call('POST', `/blockchain/verify/${docId}/file?version=1`, student, undefined, f)).data?.status;
})()) === 'TAMPERED');
// Tamper with the stored file on disk, verify, then restore it.
const dir = path.join(storageRoot, docId);
const file = path.join(dir, fs.readdirSync(dir).find((f) => f.startsWith('v1-')));
const original = fs.readFileSync(file);
const altered = Buffer.from(original); altered[altered.length - 25] ^= 0x01;
fs.writeFileSync(file, altered);
const tampered = await call('GET', `/blockchain/verify/${docId}?version=1`, student);
fs.writeFileSync(file, original);
check('modified stored file is detected: TAMPERED', tampered.data?.status === 'TAMPERED' && tampered.data.originalHash !== tampered.data.currentHash);
check('tampering v1 does not affect v2', (await call('GET', `/blockchain/verify/${docId}?version=2`, student)).data?.status === 'VERIFIED');
check('restored file verifies again', (await call('GET', `/blockchain/verify/${docId}?version=1`, student)).data?.status === 'VERIFIED');
check('students cannot trigger registration (403)', (await call('POST', '/blockchain/register', student, { documentId: docId })).status === 403);
check('re-registration is idempotent (no duplicate transaction)', (await call('POST', '/blockchain/register', faculty, { documentId: docId })).data?.map((r) => r.txHash).join() === rec.data.map((r) => r.txHash).join());

section('Audit logging');
const logs = (await call('GET', '/audit-logs?limit=100', admin)).data ?? [];
const has = (a, o) => logs.some((l) => l.action === a && (!o || l.outcome === o));
for (const a of ['USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'CASE_CREATED', 'CASE_UPDATED', 'CASE_SUBMITTED', 'CASE_APPROVED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERSION_CREATED', 'DOCUMENT_DOWNLOADED', 'BLOCKCHAIN_REGISTERED', 'DOCUMENT_VERIFIED']) {
  check(`audit log contains ${a}`, has(a));
}
check('audit log records failed logins', has('USER_LOGIN_FAILED', 'FAILURE'));
check('audit log records denied (unauthorized) requests', has('UNAUTHORIZED_ACCESS', 'DENIED'));
check('audit log records a TAMPERED verification as FAILURE', logs.some((l) => l.action === 'DOCUMENT_VERIFIED' && l.outcome === 'FAILURE' && l.metadata?.status === 'TAMPERED'));
const hist = await call('GET', '/blockchain/verifications?limit=5', student);
check('student verification history is available', hist.data?.length > 0);
check('audit log cannot be modified through the API', (await call('DELETE', `/audit-logs/${logs[0]._id}`, admin)).status === 404);

section('Cleanup');
await call('DELETE', `/cases/${caseId}`, admin);
const smokeUser = (await call('GET', `/users?search=${encodeURIComponent(email)}`, admin)).data?.[0];
if (smokeUser) await call('PATCH', `/users/${smokeUser._id}/status`, admin, { isActive: false });
check('temporary case deleted and smoke user deactivated', (await call('GET', `/cases/${caseId}`, admin)).status === 404);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
