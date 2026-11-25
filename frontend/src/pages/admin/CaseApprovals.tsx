import { CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, Modal, PageHeader, Pagination, Spinner, TextAreaField } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { caseApi } from '../../services/endpoints';
import type { LegalCase } from '../../types';
import { formatDate, personName } from '../../utils/format';

export default function CaseApprovals() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => caseApi.list({ status: 'PENDING', page, limit: 10, sort: 'recent' }), [page]);
  const [target, setTarget] = useState<{ c: LegalCase; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => { setTarget(null); setNote(''); };
  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await caseApi.review(target.c._id, target.decision, note.trim() || undefined);
      toast.success(target.decision === 'APPROVE' ? 'Case approved and published' : 'Case rejected and returned to the author');
      close();
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Case approvals" description="Review submissions before they become visible to students." />
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState icon={<ClipboardCheck className="h-10 w-10" />} title="No submissions waiting" description="New submissions from faculty will appear here." />
        : data && (
          <div className="space-y-3">
            {data.items.map((c) => (
              <Card key={c._id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link to={`/cases/${c._id}`} className="font-semibold text-navy-900 hover:underline">{c.title}</Link>
                  <p className="text-xs text-slate-500">{c.caseNumber} · {c.court} · {c.year} · {c.category}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">Submitted by {personName(c.createdBy)} on {formatDate(c.submittedAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => setTarget({ c, decision: 'APPROVE' })} icon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button>
                  <Button variant="danger" onClick={() => setTarget({ c, decision: 'REJECT' })} icon={<XCircle className="h-4 w-4" />}>Reject</Button>
                </div>
              </Card>
            ))}
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
      <Modal open={!!target} onClose={close} title={target?.decision === 'APPROVE' ? 'Approve and publish' : 'Reject case'}
        footer={<>
          <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
          <Button variant={target?.decision === 'REJECT' ? 'danger' : 'primary'} onClick={submit} loading={busy}
            disabled={target?.decision === 'REJECT' && note.trim().length < 3}>{target?.decision === 'APPROVE' ? 'Approve' : 'Reject'}</Button>
        </>}>
        <p className="mb-3 font-medium text-slate-800">{target?.c.title}</p>
        <TextAreaField label={target?.decision === 'REJECT' ? 'Reason (required)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Modal>
    </>
  );
}
