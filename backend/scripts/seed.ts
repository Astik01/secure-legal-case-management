/**
 * Development seed: demo users, landmark cases, demonstration PDFs, and blockchain registration.
 * Idempotent: safe to run repeatedly. Refuses to run in production.
 * Credentials come from SEED_* environment variables (see .env.example). DEVELOPMENT ONLY.
 */
import { connectDb, disconnectDb } from '../src/config/db';
import { env } from '../src/config/env';
import { DocumentModel } from '../src/models/Document';
import { LegalCase } from '../src/models/LegalCase';
import { User } from '../src/models/User';
import { hashPassword } from '../src/services/auth.service';
import { getBlockchain } from '../src/services/blockchain.service';
import { storeNewVersion } from '../src/services/document.service';
import { buildDemoPdf } from './demo-pdf';
import { SOURCE_URL, seedCases } from './seed-data';

async function ensureUser(name: string, email: string, password: string, role: 'ADMIN' | 'FACULTY' | 'STUDENT', extra = {}) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, role, passwordHash: await hashPassword(password), ...extra });
    console.log(`  + created ${role.toLowerCase()} ${email}`);
  } else {
    console.log(`  = ${role.toLowerCase()} ${email} already exists`);
  }
  return user;
}

async function main() {
  if (env.isProd) throw new Error('Refusing to seed demo data in production');
  await connectDb();
  const e = process.env;

  console.log('Users');
  const admin = await ensureUser('Demo Administrator', e.SEED_ADMIN_EMAIL ?? 'admin@lawschool.test', e.SEED_ADMIN_PASSWORD ?? 'Admin@12345', 'ADMIN', { institution: 'Demo Law School' });
  const faculty = await ensureUser('Dr. Demo Faculty', e.SEED_FACULTY_EMAIL ?? 'faculty@lawschool.test', e.SEED_FACULTY_PASSWORD ?? 'Faculty@12345', 'FACULTY', { institution: 'Demo Law School' });
  await ensureUser('Demo Student', e.SEED_STUDENT_EMAIL ?? 'student@lawschool.test', e.SEED_STUDENT_PASSWORD ?? 'Student@12345', 'STUDENT', { institution: 'Demo Law School', enrollmentId: 'DEMO-0001' });

  console.log('Cases and documents');
  const actor = { id: faculty.id, role: 'FACULTY' as const };
  for (const c of seedCases) {
    let legalCase = await LegalCase.findOne({ caseNumber: c.caseNumber });
    if (!legalCase) {
      const published = c.status === 'PUBLISHED';
      legalCase = await LegalCase.create({
        ...c,
        decisionDate: new Date(c.decisionDate),
        sourceUrl: SOURCE_URL,
        createdBy: faculty._id,
        submittedAt: new Date(),
        ...(published ? { reviewedBy: admin._id, reviewedAt: new Date(), publishedAt: new Date() } : {}),
      });
      console.log(`  + ${c.title} [${c.status}]`);
    } else {
      console.log(`  = ${c.title} exists`);
    }
    if (c.withDocument && !(await DocumentModel.exists({ legalCase: legalCase._id }))) {
      const pdf = await buildDemoPdf(c);
      const { document } = await storeNewVersion({
        file: { buffer: pdf, originalname: `${c.title.replace(/[^\w]+/g, '_')}_DEMO_summary.pdf`, mimetype: 'application/pdf' },
        caseId: legalCase.id,
        title: `${c.title} (demonstration summary sheet)`,
        actor,
        isDemo: true,
      });
      console.log(`    + demo document ${document.id}`);
    }
  }

  console.log('Blockchain registration');
  const docs = await DocumentModel.find();
  const svc = getBlockchain();
  for (const d of docs) {
    const { records } = await svc.registerDocumentVersions(d.id, faculty.id);
    for (const r of records) {
      console.log(`  ${r.status === 'CONFIRMED' ? 'OK' : 'NOT CONFIRMED'} document ${d.id} v${r.version}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
    }
  }
  const status = await svc.status();
  if (!status.connected) {
    console.log('\nNOTE: blockchain not reachable. Start it with `npm run chain`, deploy with `npm run chain:deploy`,');
    console.log('then re-run `npm run seed` to register the demo documents.');
  }

  console.log('\nSeed complete. Demo accounts (development only):');
  console.log(`  admin   ${admin.email}`);
  console.log(`  faculty ${faculty.email}`);
  console.log(`  student ${e.SEED_STUDENT_EMAIL ?? 'student@lawschool.test'}`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
