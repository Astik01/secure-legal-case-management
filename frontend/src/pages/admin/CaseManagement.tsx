import { Layers } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CaseStatusBadge } from '../../components/badges';
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Table, Td } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { caseApi } from '../../services/endpoints';
import type { LegalCase } from '../../types';
import { formatDate, personName } from '../../utils/format';

type Pending = { kind: 'archive' | 'delete'; c: LegalCase } | null;

export default function CaseManagement() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(
    () => caseApi.list({ page, limit: 10, sort: 'recent', ...(q ? { q } : {}), ...(status ? { status } : {}) }), [page, q, status]);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      pending.kind === 'archive' ? await caseApi.archive(pending.c._id) : await caseApi.remove(pending.c._id);
      toast.success(pending.kind === 'archive' ? 'Case archived' : 'Case deleted');
      setPending(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Case management" description="All cases in every status." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><label htmlFor="cs" className="label">Search</label>
          <input id="cs" className="input" placeholder="Title, case number, party" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <div><label htmlFor="cst" className="label">Status</label>
          <select id="cst" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>{['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState icon={<Layers className="h-10 w-10" />} title="No cases found" />
        : data && (
          <div className="space-y-4">
            <Table headers={['Case', 'Court / year', 'Author', 'Status', 'Updated', 'Actions']} caption="All cases">
              {data.items.map((c) => (
                <tr key={c._id}>
                  <Td><Link to={`/cases/${c._id}`} className="font-medium text-navy-800 hover:underline">{c.title}</Link><div className="text-xs text-slate-500">{c.caseNumber}</div></Td>
                  <Td>{c.court}<div className="text-xs text-slate-500">{c.year}</div></Td>
                  <Td>{personName(c.createdBy)}</Td>
                  <Td><CaseStatusBadge status={c.status} /></Td>
                  <Td>{formatDate(c.updatedAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Link to={`/faculty/cases/${c._id}/edit`}><Button size="sm" variant="secondary">Edit</Button></Link>
                      {c.status !== 'ARCHIVED' && <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'archive', c })}>Archive</Button>}
                      <Button size="sm" variant="danger" onClick={() => setPending({ kind: 'delete', c })}>Delete</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
      <ConfirmDialog open={!!pending} danger={pending?.kind === 'delete'} loading={busy} onCancel={() => setPending(null)} onConfirm={run}
        title={pending?.kind === 'delete' ? 'Delete case permanently' : 'Archive case'} confirmLabel={pending?.kind === 'delete' ? 'Delete case' : 'Archive'}
        message={pending?.kind === 'delete'
          ? `Delete "${pending.c.title}"? Bookmarks are removed; document files and on-chain records are retained. This cannot be undone.`
          : `Archive "${pending?.c.title}"? It will be hidden from students and faculty.`} />
    </>
  );
}
