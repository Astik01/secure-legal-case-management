import { FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CaseStatusBadge } from '../../components/badges';
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Table, Td } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { caseApi } from '../../services/endpoints';
import type { CaseStatus, LegalCase } from '../../types';
import { formatDate } from '../../utils/format';

const TABS: [string, string][] = [['', 'All'], ['DRAFT', 'Drafts'], ['PENDING', 'Pending approval'], ['PUBLISHED', 'Published'], ['REJECTED', 'Rejected']];

export default function Submissions() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<LegalCase | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(
    () => caseApi.list({ mine: 'true', limit: 10, page, sort: 'recent', ...(status ? { status } : {}) }), [status, page]);

  const submit = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await caseApi.submit(confirm._id);
      toast.success('Submitted for approval');
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Case submissions" description="Track your cases through review."
        actions={<Link to="/faculty/cases/new"><Button icon={<FilePlus2 className="h-4 w-4" />}>Add case</Button></Link>} />
      <div role="tablist" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1">
        {TABS.map(([v, l]) => (
          <button key={l} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === v ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState title="Nothing here yet" description="Cases you create will appear here with their review status." />
        : data && (
          <div className="space-y-4">
            <Table headers={['Case', 'Status', 'Updated', 'Reviewer note', 'Actions']} caption="My case submissions">
              {data.items.map((c) => (
                <tr key={c._id}>
                  <Td><Link to={`/cases/${c._id}`} className="font-medium text-navy-800 hover:underline">{c.title}</Link><div className="text-xs text-slate-500">{c.caseNumber}</div></Td>
                  <Td><CaseStatusBadge status={c.status as CaseStatus} /></Td>
                  <Td>{formatDate(c.updatedAt)}</Td>
                  <Td className="max-w-xs text-xs">{c.reviewNote ?? '-'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {['DRAFT', 'REJECTED'].includes(c.status) && <>
                        <Link to={`/faculty/cases/${c._id}/edit`}><Button size="sm" variant="secondary">Edit</Button></Link>
                        <Button size="sm" onClick={() => setConfirm(c)}>Submit</Button>
                      </>}
                      {c.status !== 'ARCHIVED' && <Link to={`/faculty/cases/${c._id}/documents`}><Button size="sm" variant="ghost">Documents</Button></Link>}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
      <ConfirmDialog open={!!confirm} title="Submit for approval" loading={busy} confirmLabel="Submit" onCancel={() => setConfirm(null)} onConfirm={submit}
        message={`Submit "${confirm?.title}" to an administrator for review? You will not be able to edit it while it is pending.`} />
    </>
  );
}
