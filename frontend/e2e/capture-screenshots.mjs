/**
 * Captures real screenshots of the running application with Playwright (system Chrome, no download).
 *
 * Prerequisites: MongoDB, the Hardhat chain, the deployed contract, the seeded database, the backend (4000)
 * and the frontend (5173) are all running. See README "Running the project".
 *
 *   npm run screenshots -w frontend
 *
 * Only DEMO accounts from the seed are used. Passwords are typed into forms but no screenshot is taken while
 * a password field is filled. For the TAMPERED example the script temporarily modifies one stored demo PDF
 * on disk and restores the original bytes afterwards.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'docs/screenshots');
const storage = path.join(root, 'backend/storage');
const requireBackend = createRequire(path.join(root, 'backend/package.json'));
const { PDFDocument, StandardFonts } = requireBackend('pdf-lib');

const BASE = process.env.APP_URL ?? 'http://localhost:5173';
const env = process.env;
const ACCOUNTS = {
  student: [env.SEED_STUDENT_EMAIL ?? 'student@lawschool.test', env.SEED_STUDENT_PASSWORD ?? 'Student@12345'],
  faculty: [env.SEED_FACULTY_EMAIL ?? 'faculty@lawschool.test', env.SEED_FACULTY_PASSWORD ?? 'Faculty@12345'],
  admin: [env.SEED_ADMIN_EMAIL ?? 'admin@lawschool.test', env.SEED_ADMIN_PASSWORD ?? 'Admin@12345'],
};
const VIEWPORT = { width: 1440, height: 900 };

fs.mkdirSync(out, { recursive: true });
const shots = [];
const failures = [];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page, extra = 600) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('[role="status"]:not([aria-live])') || !/Loading/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await wait(extra);
}

async function shot(page, name, { fullPage = false, extra = 600 } = {}) {
  await settle(page, extra);
  const errorBanner = await page.locator('[role="alert"]:has-text("Could not load")').count();
  if (errorBanner) throw new Error(`${name}: page shows a load error`);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  shots.push(name);
  console.log(`captured  ${name}.png`);
}

// Optional: ONLY=audit-logs,user-management re-captures just those steps (e.g. after a UI change).
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function step(name, fn) {
  if (only && !only.includes(name)) return;
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${e.message.split('\n')[0]}`);
    console.log(`FAILED    ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function login(context, role) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email/).fill(ACCOUNTS[role][0]);
  await page.getByLabel(/Password/).fill(ACCOUNTS[role][1]);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(new RegExp(`/${role}$`), { timeout: 20000 });
  return page;
}

const api = (page, url) =>
  page.evaluate(async (u) => (await fetch(`/api${u}`, { credentials: 'include' })).json(), url);

async function newPdf(text) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  page.drawText('DEMONSTRATION MATERIAL - NOT AN OFFICIAL COURT DOCUMENT', { x: 50, y: 790, size: 11, font });
  page.drawText(text, { x: 50, y: 750, size: 12, font });
  return Buffer.from(await pdf.save());
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fresh = () => browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: 'light' });

try {
  /* ---------- Public pages (anonymous) ---------- */
  {
    const ctx = await fresh();
    const page = await ctx.newPage();
    await step('landing-page', async () => { await page.goto(BASE); await shot(page, 'landing-page'); });
    await step('login', async () => {
      await page.goto(`${BASE}/login`);
      await page.getByLabel(/Email/).fill(ACCOUNTS.student[0]); // demo email only; password left empty
      await shot(page, 'login');
    });
    await step('register', async () => { await page.goto(`${BASE}/register`); await shot(page, 'register'); });
    await ctx.close();
  }

  /* ---------- Student ---------- */
  let kesavanandaCaseId, kesavanandaDocId, manekaDocId, manekaCaseId;
  {
    const ctx = await fresh();
    const page = await login(ctx, 'student');
    await step('student-dashboard', async () => { await page.goto(`${BASE}/student`); await shot(page, 'student-dashboard', { extra: 1800 }); });
    await step('case-explorer', async () => {
      await page.goto(`${BASE}/cases`);
      await page.getByText('Maneka Gandhi v. Union of India').first().waitFor();
      await shot(page, 'case-explorer');
    });

    const list = await api(page, '/cases?limit=50');
    const find = (t) => list.data.find((c) => c.title.startsWith(t));
    kesavanandaCaseId = find('Kesavananda')?._id;
    manekaCaseId = find('Maneka')?._id;
    const docsOf = async (id) => (await api(page, `/documents?caseId=${id}`)).data;
    kesavanandaDocId = (await docsOf(kesavanandaCaseId))[0]?._id;
    manekaDocId = (await docsOf(manekaCaseId))[0]?._id;

    await step('case-details', async () => {
      await page.goto(`${BASE}/cases/${manekaCaseId}`);
      await page.getByText('Key holdings').waitFor();
      await shot(page, 'case-details');
    });

    await step('blockchain-verified', async () => {
      await page.goto(`${BASE}/documents/${manekaDocId}`);
      await page.getByRole('button', { name: 'Verify stored document' }).click();
      await page.getByText('Document verified').waitFor({ timeout: 20000 });
      await page.getByText('Document verified').scrollIntoViewIfNeeded();
      await shot(page, 'blockchain-verified', { extra: 1200 });
    });

    // Genuine tamper demonstration: modify the stored file on disk, verify, then restore the exact bytes.
    await step('blockchain-tampered', async () => {
      const dir = path.join(storage, manekaDocId);
      const file = path.join(dir, fs.readdirSync(dir).find((f) => f.startsWith('v1-')));
      const original = fs.readFileSync(file);
      const altered = Buffer.from(original);
      altered[altered.length - 40] ^= 0x01;
      fs.writeFileSync(file, altered);
      try {
        await page.goto(`${BASE}/documents/${manekaDocId}`);
        await page.getByRole('button', { name: 'Verify stored document' }).click();
        await page.getByText('Document does not match its blockchain record').waitFor({ timeout: 20000 });
        await page.getByText('Document does not match its blockchain record').scrollIntoViewIfNeeded();
        await shot(page, 'blockchain-tampered', { extra: 1200 });
      } finally {
        fs.writeFileSync(file, original);
      }
      const check = await api(page, `/blockchain/verify/${manekaDocId}`);
      if (check.data.status !== 'VERIFIED') throw new Error('original file was not restored correctly');
      console.log('          (stored demo file restored; re-verification = VERIFIED)');
    });
    await ctx.close();
  }

  /* ---------- Faculty ---------- */
  {
    const ctx = await fresh();
    const page = await login(ctx, 'faculty');
    await step('faculty-dashboard', async () => { await page.goto(`${BASE}/faculty`); await shot(page, 'faculty-dashboard', { extra: 1800 }); });

    await step('case-creation', async () => {
      await page.goto(`${BASE}/faculty/cases/new`);
      await page.getByLabel(/^Title/).fill('Olga Tellis v. Bombay Municipal Corporation');
      await page.getByLabel(/^Case number/).fill('Writ Petition (Civil) 4610-4612 of 1981');
      await page.getByLabel(/^Citation/).fill('(1985) 3 SCC 545');
      await page.getByLabel(/^Category/).selectOption('Constitutional Law');
      await page.getByLabel(/^Summary/).fill('Draft entry shown for the screenshot only; this form is not submitted.');
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, 'case-creation'); // intentionally not submitted: no data is created
    });

    await step('document-upload', async () => {
      await page.goto(`${BASE}/faculty/cases/${kesavanandaCaseId}/documents`);
      await page.getByText('Documents on this case').waitFor();
      const versionsBefore = (await api(page, `/documents/${kesavanandaDocId}/versions`)).data.length;
      if (versionsBefore < 2) {
        await page.getByLabel('Upload as').selectOption(kesavanandaDocId);
        await page.locator('#pdf').setInputFiles({
          name: 'kesavananda-demo-v2.pdf', mimeType: 'application/pdf',
          buffer: await newPdf('Kesavananda Bharati - demonstration revision (version 2)'),
        });
        await page.getByText('kesavananda-demo-v2.pdf').waitFor();
        await shot(page, 'document-upload'); // file chosen, before upload
        await page.getByRole('button', { name: /Upload and register hash/ }).click();
        await page.getByText(/version 2 stored/).waitFor({ timeout: 30000 });
        await page.getByText('Confirmed on-chain').waitFor();
        console.log('          (uploaded demo version 2, confirmed on-chain)');
      } else {
        await shot(page, 'document-upload');
      }
    });
    await ctx.close();
  }

  /* ---------- Document version history (needs version 2) ---------- */
  {
    const ctx = await fresh();
    const page = await login(ctx, 'student');
    await step('document-versions', async () => {
      await page.goto(`${BASE}/documents/${kesavanandaDocId}`);
      await page.getByText('Version history').waitFor();
      await page.getByRole('button', { name: 'Verify stored document' }).click();
      await page.getByText('Document verified').waitFor({ timeout: 20000 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await shot(page, 'document-versions', { extra: 1000 });
    });
    await ctx.close();
  }

  /* ---------- Administrator ---------- */
  {
    const ctx = await fresh();
    const page = await login(ctx, 'admin');
    await step('admin-dashboard', async () => { await page.goto(`${BASE}/admin`); await shot(page, 'admin-dashboard'); });
    await step('user-management', async () => {
      await page.goto(`${BASE}/admin/users`);
      await page.getByText('Demo Student').waitFor();
      await shot(page, 'user-management');
    });
    await step('audit-logs', async () => {
      await page.goto(`${BASE}/admin/audit-logs`);
      await page.locator('td code', { hasText: 'DOCUMENT_VERIFIED' }).first().waitFor();
      await shot(page, 'audit-logs');
    });
    await step('blockchain-records', async () => {
      await page.goto(`${BASE}/admin/blockchain`);
      await page.getByText('Confirmed on-chain').first().waitFor();
      await shot(page, 'blockchain-records');
    });
    await step('admin-analytics', async () => { await page.goto(`${BASE}/admin/analytics`); await shot(page, 'admin-analytics', { extra: 2200 }); });
    await step('case-approvals', async () => { await page.goto(`${BASE}/admin/approvals`); await shot(page, 'case-approvals'); });
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${shots.length} screenshots captured, ${failures.length} failed`);
failures.forEach((f) => console.log(`  - ${f}`));
process.exit(failures.length ? 1 : 0);
