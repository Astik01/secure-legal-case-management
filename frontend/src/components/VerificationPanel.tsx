import { FileUp, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import type { VerificationResult } from '../types';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../services/api';
import { chainApi } from '../services/endpoints';
import { formatDate } from '../utils/format';
import { HashText, VerificationBadge } from './badges';
import { Alert, Button, Card } from './ui';

const kindFor = { VERIFIED: 'success', TAMPERED: 'error', NOT_REGISTERED: 'warning', VERIFICATION_ERROR: 'info' } as const;
const titleFor = {
  VERIFIED: 'Document verified',
  TAMPERED: 'Document does not match its blockchain record',
  NOT_REGISTERED: 'No blockchain registration found',
  VERIFICATION_ERROR: 'Verification could not be completed',
} as const;

export function VerificationResultView({ r }: { r: VerificationResult }) {
  const rows: [string, React.ReactNode][] = [
    ['Verification status', <VerificationBadge key="s" status={r.status} />],
    ['Document identifier', <HashText key="k" value={r.documentKey} />],
    ['Version', r.version],
    ['Original hash (registered on-chain)', <HashText key="o" value={r.originalHash} full />],
    [r.source === 'UPLOADED_COPY' ? 'Current hash (uploaded copy)' : 'Current hash (computed now)', <HashText key="c" value={r.currentHash} full />],
    ['Blockchain transaction ID', <HashText key="t" value={r.txHash} full />],
    ['Block number', r.blockNumber ?? '-'],
    ['Registration timestamp', formatDate(r.registeredAt, true)],
    ['Registered by (account)', <HashText key="rg" value={r.registrar} />],
    ['Verified at', formatDate(r.verifiedAt, true)],
  ];
  return (
    <div className="space-y-4" aria-live="polite">
      <Alert kind={kindFor[r.status]} title={titleFor[r.status]}>{r.message}</Alert>
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="min-w-0 text-sm text-slate-800 sm:col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
      {r.status === 'TAMPERED' && (
        <p className="text-xs text-slate-500">
          The stored database hash ({r.databaseHash.slice(0, 10)}...) is shown for reference only. The blockchain record is the authority.
        </p>
      )}
    </div>
  );
}

export function VerificationPanel({ documentId, version, onDone }: { documentId: string; version?: number; onDone?: () => void }) {
  const toast = useToast();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<'stored' | 'copy' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (kind: 'stored' | 'copy', fn: () => Promise<VerificationResult>) => {
    setBusy(kind);
    try {
      setResult(await fn());
      onDone?.();
    } catch (e) {
      setResult(null);
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Integrity verification</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Re-computes the SHA-256 hash and compares it with the hash registered on the blockchain{version ? ` for version ${version}` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run('stored', () => chainApi.verify(documentId, version))} loading={busy === 'stored'}
            disabled={busy !== null} icon={<ShieldCheck className="h-4 w-4" />}>Verify stored document</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={busy === 'copy'} disabled={busy !== null}
            icon={<FileUp className="h-4 w-4" />}>Verify my copy</Button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Choose a PDF copy to verify" tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void run('copy', () => chainApi.verifyCopy(documentId, f, version));
            }} />
        </div>
      </div>
      {result && <div className="mt-5"><VerificationResultView r={result} /></div>}
    </Card>
  );
}
