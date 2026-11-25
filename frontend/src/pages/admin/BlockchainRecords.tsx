import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChainStatusBadge, HashText } from '../../components/badges';
import { Alert, Button, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Table, Td } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { chainApi } from '../../services/endpoints';
import { formatDate } from '../../utils/format';

export default function BlockchainRecords() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(() => chainApi.allRecords({ page, limit: 15, ...(status ? { status } : {}) }), [page, status]);

  const retry = async (docId: string, version: number, recId: string) => {
    setBusyId(recId);
    try {
      const res = await chainApi.register(docId, version);
      const failed = res.find((r) => r.status === 'FAILED');
      failed ? toast.error(`Failed: ${failed.error}`) : toast.success('Registration processed');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader title="Blockchain records" description="Every document hash registration, with its transaction status." />
      <div className="mb-4"><Alert kind="info" title="Submitted is not confirmed">
        A registration counts only once its transaction is mined (<strong>Confirmed on-chain</strong>). Submitted or failed records can be retried safely; confirmed versions are never sent twice.
      </Alert></div>
      <div className="mb-3 flex items-center gap-3">
        <label htmlFor="bs" className="text-sm text-slate-600">Status</label>
        <select id="bs" className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>{['CONFIRMED', 'SUBMITTED', 'FAILED', 'PENDING'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState icon={<Link2 className="h-10 w-10" />} title="No blockchain records" description="Records appear when documents are uploaded." />
        : data && (
          <div className="space-y-4">
            <Table headers={['Document', 'Ver.', 'Status', 'Content hash', 'Transaction', 'Block', 'Confirmed', '']} caption="Blockchain registrations">
              {data.items.map((r) => {
                const doc = typeof r.document === 'string' ? null : r.document;
                const docId = doc ? doc._id : String(r.document);
                return (
                  <tr key={r._id}>
                    <Td><Link to={`/documents/${docId}`} className="text-navy-800 hover:underline">{doc?.title ?? 'Document'}</Link>
                      {doc?.legalCase && <div className="text-xs text-slate-500">{doc.legalCase.caseNumber}</div>}</Td>
                    <Td>v{r.version}</Td>
                    <Td><ChainStatusBadge status={r.status} />{r.error && <p className="mt-1 max-w-[220px] text-xs text-red-700">{r.error}</p>}</Td>
                    <Td><HashText value={r.contentHash} /></Td>
                    <Td><HashText value={r.txHash} /></Td>
                    <Td>{r.blockNumber ?? '-'}</Td>
                    <Td>{formatDate(r.confirmedAt, true)}</Td>
                    <Td>{r.status !== 'CONFIRMED' && <Button size="sm" variant="secondary" loading={busyId === r._id} onClick={() => retry(docId, r.version, r._id)}>Retry</Button>}</Td>
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
