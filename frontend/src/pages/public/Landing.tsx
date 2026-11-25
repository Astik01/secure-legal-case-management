import { BookOpenCheck, FileCheck2, Fingerprint, History, Lock, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';

const features = [
  { icon: Lock, title: 'Role-based access', text: 'Students, faculty and administrators each see only what their role allows. Permissions are enforced on the server, not just in the interface.' },
  { icon: BookOpenCheck, title: 'Searchable case library', text: 'Browse landmark judgments by title, case number, court, year and category, with summaries, key holdings and bookmarks.' },
  { icon: Fingerprint, title: 'SHA-256 fingerprints', text: 'Every uploaded judgment PDF is hashed from its original bytes. The hash, not the file, is what gets registered.' },
  { icon: ShieldCheck, title: 'Blockchain verification', text: 'Hashes are written to an Ethereum-compatible smart contract. Verification re-hashes the document and compares it with the on-chain record.' },
  { icon: History, title: 'Immutable versions', text: 'New document versions are appended, never overwritten. Earlier hashes stay readable on the chain.' },
  { icon: FileCheck2, title: 'Audit trail', text: 'Logins, uploads, approvals, verifications and denied requests are recorded for review by authorized staff.' },
];

const steps = [
  ['Upload', 'Faculty upload a judgment PDF to a case. The server validates it and stores it privately.'],
  ['Fingerprint', 'The server computes the SHA-256 hash of the exact file bytes.'],
  ['Register', 'The hash is written to the LegalDocumentRegistry smart contract with its version number.'],
  ['Verify', 'Anyone with access can re-check the document. Altered files are reported as TAMPERED.'],
];

export default function Landing() {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-navy-100">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Blockchain-enabled data integrity
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight !text-white sm:text-5xl">
              A trustworthy legal case library for law students.
            </h1>
            <p className="mt-4 max-w-xl text-navy-100">
              Research landmark judgments, manage case records with role-based permissions, and prove that a document
              has not been altered since it was registered.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register"><Button className="!bg-white !text-navy-900 hover:!bg-navy-50">Create a student account</Button></Link>
              <Link to="/login"><Button variant="ghost" className="!text-white hover:!bg-white/10">Sign in</Button></Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6" aria-label="Example verification result">
            <p className="text-xs uppercase tracking-wider text-navy-200">Example verification</p>
            <div className="mt-3 flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-5 w-5" aria-hidden /> <span className="font-semibold">VERIFIED</span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-navy-300">Registered hash (on-chain)</dt><dd className="break-all font-mono text-xs text-white">0x9f2c...b41e07</dd></div>
              <div><dt className="text-navy-300">Current hash (computed now)</dt><dd className="break-all font-mono text-xs text-white">0x9f2c...b41e07</dd></div>
              <div className="flex gap-6"><div><dt className="text-navy-300">Version</dt><dd>1</dd></div><div><dt className="text-navy-300">Block</dt><dd>#7</dd></div></div>
            </dl>
            <p className="mt-4 text-xs text-navy-300">Illustration only. Real results appear after you open a document.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-semibold">Built for study, designed for trust</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="mb-3 inline-flex rounded-lg bg-navy-50 p-2 text-navy-700"><f.icon className="h-5 w-5" aria-hidden /></div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold">How document integrity works</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-4">
            {steps.map(([t, d], i) => (
              <li key={t} className="relative rounded-xl border border-slate-200 p-5">
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">{i + 1}</span>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Users className="mx-auto h-8 w-8 text-navy-600" aria-hidden />
        <h2 className="mt-3 text-2xl font-semibold">Start researching with confidence</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Faculty and administrator accounts are created by your institution administrator.</p>
        <Link to="/register" className="mt-6 inline-block"><Button>Create a student account</Button></Link>
      </section>
    </>
  );
}
