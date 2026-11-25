import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { VerificationBadge } from '../../components/badges';
import { Alert, Button, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Table, Td } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { chainApi } from '../../services/endpoints';
import type { VerificationStatus } from '../../types';
import { formatDate, shortHash } from '../../utils/format';

/** Student "blockchain verification" hub and the faculty/admin verification history. */
export default function VerificationHistory() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(() => chainApi.history({ page, limit: 15, ...(status ? { status } : {}) }), [page, status]);
  const student = user!.role === 'STUDENT';

  return (
    <>
      <PageHeader title={student ? 'Blockchain verification' : 'Verification history'}
        description={student ? 'Check that a judgment PDF matches the hash registered on the blockchain.' : 'Integrity checks run on documents you manage.'}
        actions={<Link to="/cases"><Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />}>Find a document</Button></Link>} />
      {student && (
        <div className="mb-5"><Alert kind="info" title="How to verify">
          Open a case, choose <strong>View and verify</strong> on a document, then run <strong>Verify stored document</strong>,
          or upload a PDF you downloaded earlier with <strong>Verify my copy</strong>.
        </Alert></div>
      )}
      <div className="mb-3 flex items-center gap-3">
        <label htmlFor="vs" className="text-sm text-slate-600">Outcome</label>
        <select id="vs" className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          {(['VERIFIED', 'TAMPERED', 'NOT_REGISTERED', 'VERIFICATION_ERROR'] as VerificationStatus[]).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState icon={<ShieldCheck className="h-10 w-10" />} title="No verifications yet" description="Results of integrity checks will be listed here." />
        : data && (
          <div className="space-y-4">
            <Table headers={['When', 'Document', 'Version', 'Source', 'Outcome', 'Hash checked', ...(student ? [] : ['By'])]} caption="Verification history">
              {data.items.map((e) => {
                const m = (e.metadata ?? {}) as { status?: VerificationStatus; version?: number; source?: string; currentHash?: string };
                return (
                  <tr key={e._id}>
                    <Td>{formatDate(e.createdAt, true)}</Td>
                    <Td><Link className="text-navy-700 underline" to={`/documents/${e.resourceId}`}>Open document</Link></Td>
                    <Td>{m.version ?? '-'}</Td>
                    <Td>{m.source === 'UPLOADED_COPY' ? 'Uploaded copy' : 'Stored file'}</Td>
                    <Td>{m.status ? <VerificationBadge status={m.status} /> : '-'}</Td>
                    <Td><code className="font-mono text-xs">{shortHash(m.currentHash)}</code></Td>
                    {!student && <Td>{e.actor?.name ?? '-'}</Td>}
                  </tr>
                );
              })}
            </Table>
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
    </>
  );
}
