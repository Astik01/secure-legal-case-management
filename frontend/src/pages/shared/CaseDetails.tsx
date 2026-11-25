import { Archive, BookmarkCheck, BookmarkPlus, CheckCircle2, Download, ExternalLink, FilePlus2, FileText, Pencil, Send, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CaseStatusBadge } from '../../components/badges';
import {
  Alert, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner, TextAreaField,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { bookmarkApi, caseApi, documentApi } from '../../services/endpoints';
import { formatBytes, formatDate, personName } from '../../utils/format';

type Action = 'submit' | 'archive' | 'delete' | 'approve' | 'reject' | null;

export default function CaseDetails() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: c, loading, error, reload } = useAsync(() => caseApi.get(id), [id]);
  const docs = useAsync(() => documentApi.forCase(id), [id]);
  const [action, setAction] = useState<Action>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !c) return <Spinner label="Loading case" />;
  if (error || !c) {
    return error?.includes('not found') || !c
      ? <EmptyState title="Case not found" description="It may have been removed, or it is not available to your account." action={<Link to="/cases"><Button>Back to explorer</Button></Link>} />
      : <ErrorState message={error!} onRetry={reload} />;
  }

  const role = user!.role;
  const createdById = typeof c.createdBy === 'string' ? c.createdBy : c.createdBy._id;
  const isOwner = createdById === user!._id;
  const canEdit = role === 'ADMIN' || (role === 'FACULTY' && isOwner && ['DRAFT', 'REJECTED'].includes(c.status));
  const canSubmit = (role === 'ADMIN' || (role === 'FACULTY' && isOwner)) && ['DRAFT', 'REJECTED'].includes(c.status);
  const canUpload = (role === 'ADMIN' || (role === 'FACULTY' && isOwner)) && c.status !== 'ARCHIVED';
  const canReview = role === 'ADMIN' && c.status === 'PENDING';

  const run = async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      setAction(null);
      setNote('');
      after ? after() : reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleBookmark = () =>
    run(async () => (c.bookmarkId ? bookmarkApi.remove(c.bookmarkId) : bookmarkApi.add(c._id)), c.bookmarkId ? 'Bookmark removed' : 'Bookmarked');

  return (
    <>
      <PageHeader
        title={c.title}
        description={<span className="flex flex-wrap items-center gap-2"><CaseStatusBadge status={c.status} /><Badge tone="blue">{c.category}</Badge><span>{c.citation ?? c.caseNumber}</span></span>}
        actions={
          <>
            <Button variant="secondary" onClick={toggleBookmark} loading={busy && action === null}
              icon={c.bookmarkId ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}>
              {c.bookmarkId ? 'Bookmarked' : 'Bookmark'}
            </Button>
            {canEdit && <Link to={`/faculty/cases/${c._id}/edit`}><Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Edit</Button></Link>}
            {canUpload && <Link to={`/faculty/cases/${c._id}/documents`}><Button variant="secondary" icon={<FilePlus2 className="h-4 w-4" />}>Upload document</Button></Link>}
            {canSubmit && <Button onClick={() => setAction('submit')} icon={<Send className="h-4 w-4" />}>Submit for approval</Button>}
          </>
        }
      />

      {c.status === 'REJECTED' && c.reviewNote && (
        <div className="mb-5"><Alert kind="warning" title="Returned by reviewer">{c.reviewNote}</Alert></div>
      )}
      {canReview && (
        <div className="mb-5">
          <Alert kind="info" title="Awaiting your review"
            action={<div className="flex gap-2">
              <Button size="sm" onClick={() => setAction('approve')} icon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => setAction('reject')} icon={<XCircle className="h-4 w-4" />}>Reject</Button>
            </div>}>
            Submitted {formatDate(c.submittedAt)} by {personName(c.createdBy)}.
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold">Summary</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{c.summary}</p>
            {c.keyHoldings.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Key holdings</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
                  {c.keyHoldings.map((h, i) => <li key={i}>{h}</li>)}
                </ol>
              </>
            )}
            {c.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Documents</h2>
            {docs.loading && !docs.data ? <Spinner /> : docs.error ? <ErrorState message={docs.error} onRetry={docs.reload} />
              : docs.data && docs.data.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {docs.data.map((d) => (
                    <li key={d._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 text-navy-500" aria-hidden />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{d.title}</p>
                          <p className="text-xs text-slate-500">
                            Version {d.currentVersion}{d.current ? ` · ${formatBytes(d.current.size)}` : ''}
                            {d.isDemo && <> · <span className="font-medium text-amber-700">Demonstration material</span></>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/documents/${d._id}`}><Button size="sm" variant="secondary" icon={<ShieldCheck className="h-4 w-4" />}>View and verify</Button></Link>
                        <a href={documentApi.downloadUrl(d._id)}><Button size="sm" variant="ghost" icon={<Download className="h-4 w-4" />}>Download</Button></a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-500">No documents have been uploaded for this case.</p>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-semibold">Case details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {([
                ['Case number', c.caseNumber], ['Court', c.court], ['Year', String(c.year)], ['Decided', formatDate(c.decisionDate)],
                ['Petitioner', c.petitioner], ['Respondent', c.respondent], ['Bench', c.bench],
              ] as [string, string | undefined][]).filter(([, v]) => v && v !== '-').map(([k, v]) => (
                <div key={k}><dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-slate-800">{v}</dd></div>
              ))}
              {role !== 'STUDENT' && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Created by</dt><dd>{personName(c.createdBy)}</dd></div>}
              {c.sourceUrl && (
                <div><dt className="text-xs uppercase tracking-wide text-slate-500">Source</dt>
                  <dd><a className="inline-flex items-center gap-1 text-navy-700 underline" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">Official judgments portal <ExternalLink className="h-3 w-3" aria-hidden /></a></dd></div>
              )}
            </dl>
          </Card>
          {role === 'ADMIN' && (
            <Card>
              <h2 className="text-lg font-semibold">Administration</h2>
              <div className="mt-3 flex flex-col gap-2">
                {c.status !== 'ARCHIVED' && <Button variant="secondary" onClick={() => setAction('archive')} icon={<Archive className="h-4 w-4" />}>Archive case</Button>}
                <Button variant="danger" onClick={() => setAction('delete')} icon={<Trash2 className="h-4 w-4" />}>Delete case</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog open={action === 'submit'} title="Submit for approval" loading={busy}
        message="An administrator will review this case. You will not be able to edit it while it is pending."
        confirmLabel="Submit" onCancel={() => setAction(null)}
        onConfirm={() => run(() => caseApi.submit(c._id), 'Submitted for approval')} />
      <ConfirmDialog open={action === 'archive'} title="Archive case" loading={busy}
        message="Archived cases are hidden from students and faculty. Documents and blockchain records are kept."
        confirmLabel="Archive" onCancel={() => setAction(null)}
        onConfirm={() => run(() => caseApi.archive(c._id), 'Case archived')} />
      <ConfirmDialog open={action === 'delete'} title="Delete case permanently" danger loading={busy}
        message="This removes the case and its bookmarks. Document files and on-chain records are retained for audit purposes. This cannot be undone."
        confirmLabel="Delete case" onCancel={() => setAction(null)}
        onConfirm={() => run(() => caseApi.remove(c._id), 'Case deleted', () => navigate('/admin/cases'))} />
      <Modal open={action === 'approve' || action === 'reject'} onClose={() => setAction(null)}
        title={action === 'approve' ? 'Approve and publish' : 'Reject case'}
        footer={<>
          <Button variant="secondary" onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
          <Button variant={action === 'reject' ? 'danger' : 'primary'} loading={busy}
            disabled={action === 'reject' && note.trim().length < 3}
            onClick={() => run(() => caseApi.review(c._id, action === 'approve' ? 'APPROVE' : 'REJECT', note.trim() || undefined), action === 'approve' ? 'Case published' : 'Case rejected')}>
            {action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </>}>
        <p className="mb-3">{action === 'approve' ? 'Publishing makes this case visible to all students and faculty.' : 'Explain what the author should fix. The note is shown to them.'}</p>
        <TextAreaField label={action === 'reject' ? 'Reason (required)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Modal>
    </>
  );
}
