import { Check, Copy, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react';
import { useState } from 'react';
import type { CaseStatus, ChainStatus, VerificationStatus } from '../types';
import { shortHash, titleCase } from '../utils/format';
import { Badge, Tone } from './ui';

const caseTone: Record<CaseStatus, Tone> = {
  DRAFT: 'slate', PENDING: 'amber', PUBLISHED: 'green', REJECTED: 'red', ARCHIVED: 'slate',
};
export const CaseStatusBadge = ({ status }: { status: CaseStatus }) => <Badge tone={caseTone[status]}>{titleCase(status)}</Badge>;

const chainTone: Record<ChainStatus, Tone> = { PENDING: 'slate', SUBMITTED: 'amber', CONFIRMED: 'green', FAILED: 'red' };
const chainLabel: Record<ChainStatus, string> = {
  PENDING: 'Not submitted', SUBMITTED: 'Submitted (awaiting confirmation)', CONFIRMED: 'Confirmed on-chain', FAILED: 'Registration failed',
};
export const ChainStatusBadge = ({ status }: { status: ChainStatus }) => <Badge tone={chainTone[status]}>{chainLabel[status]}</Badge>;

const verTone: Record<VerificationStatus, Tone> = { VERIFIED: 'green', TAMPERED: 'red', NOT_REGISTERED: 'amber', VERIFICATION_ERROR: 'slate' };
const verIcon = {
  VERIFIED: <ShieldCheck className="h-3.5 w-3.5" aria-hidden />,
  TAMPERED: <ShieldX className="h-3.5 w-3.5" aria-hidden />,
  NOT_REGISTERED: <ShieldQuestion className="h-3.5 w-3.5" aria-hidden />,
  VERIFICATION_ERROR: <ShieldAlert className="h-3.5 w-3.5" aria-hidden />,
};
export const VerificationBadge = ({ status }: { status: VerificationStatus }) => (
  <Badge tone={verTone[status]} icon={verIcon[status]}>{status.replace(/_/g, ' ')}</Badge>
);

/** Monospace hash with copy button; full value is available via title and clipboard. */
export function HashText({ value, full = false }: { value?: string | null; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-slate-400">-</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <code title={value} className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
        {full ? value : shortHash(value)}
      </code>
      <button type="button" aria-label="Copy to clipboard" className="text-slate-400 hover:text-navy-700"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
