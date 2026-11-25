import { PageHeader, Card, Alert } from '../../components/ui';

export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeader title="About LexVault" description="A secure, role-based legal case database for law students, with blockchain-anchored document integrity." />
      <div className="space-y-5">
        <Card>
          <h2 className="text-lg font-semibold">The problem</h2>
          <p className="mt-2 text-sm text-slate-600">
            Law students rely on judgments and case notes collected from many places, often as loose PDFs. It is hard to know
            whether a copy is complete, current, or has been altered, and shared drives offer little control over who can add or change records.
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">What the platform provides</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>A central, searchable library of legal cases with summaries and key holdings.</li>
            <li>Three roles. Students research and verify, faculty curate and upload, administrators approve and oversee.</li>
            <li>Private document storage with SHA-256 fingerprints for every file version.</li>
            <li>A smart contract that stores each fingerprint so that later alteration is detectable.</li>
            <li>An audit trail of important actions for accountability.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">How integrity checking works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>When a PDF is uploaded, the server computes its SHA-256 hash from the original bytes.</li>
            <li>The hash, a version number and an opaque uploader reference are registered on the blockchain. The PDF itself is never put on-chain.</li>
            <li>To verify, the server re-hashes the stored file, reads the registered hash from the contract, and compares the two.</li>
            <li>The result is VERIFIED, TAMPERED, NOT REGISTERED, or VERIFICATION ERROR when the chain cannot be reached.</li>
          </ol>
        </Card>
        <Alert kind="info" title="What this does and does not prove">
          A match proves the file is byte-for-byte identical to what was registered. It does not prove the original upload
          was an authentic court-issued document, and application audit logs are database records, not blockchain records.
          Sample documents in this deployment are generated demonstration summaries, not official judgments.
        </Alert>
      </div>
    </div>
  );
}
