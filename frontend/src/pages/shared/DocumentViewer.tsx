import { ArrowLeft, Download, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChainStatusBadge, HashText } from '../../components/badges';
import { Alert, Button, Card, EmptyState, ErrorState, PageHeader, Spinner, Table, Td } from '../../components/ui';
import { VerificationPanel } from '../../components/VerificationPanel';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { chainApi, documentApi } from '../../services/endpoints';
import { formatBytes, formatDate, personName } from '../../utils/format';

export default function DocumentViewer() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const doc = useAsync(() => documentApi.get(id), [id]);
  const versions = useAsync(() => documentApi.versions(id), [id]);
  const records = useAsync(() => chainApi.records(id), [id]);
  const [version, setVersion] = useState<number | undefined>();
  const [blob, setBlob] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const selected = version ?? doc.data?.currentVersion;

  useEffect(() => {
    if (!doc.data) return;
    let url: string | null = null;
    let cancelled = false;
    setBlob(null);
    setPreviewError(null);
    documentApi.blobUrl(id, selected).then(
      (u) => { if (cancelled) URL.revokeObjectURL(u); else { url = u; setBlob(u); } },
      (e) => !cancelled && setPreviewError(errorMessage(e)),
    );
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id, selected, doc.data]);

  if (doc.loading && !doc.data) return <Spinner label="Loading document" />;
  if (doc.error || !doc.data) {
    return <EmptyState title="Document not found" description="It may not exist, or you may not have access to it." action={<Link to="/cases"><Button>Back to cases</Button></Link>} />;
  }
  const d = doc.data;
  const canRegister = user!.role !== 'STUDENT';
  const unconfirmed = (records.data ?? []).some((r) => r.status !== 'CONFIRMED');

  const register = async () => {
    setRegistering(true);
    try {
      const res = await chainApi.register(id);
      const failed = res.find((r) => r.status === 'FAILED');
      failed ? toast.error(`Registration failed: ${failed.error ?? 'unknown error'}`) : toast.success('Blockchain registration processed');
      records.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <>
      <PageHeader title={d.title}
        description={<span>{d.isDemo && <strong className="text-amber-700">Demonstration material. </strong>}Version {d.currentVersion} is the latest.</span>}
        actions={
          <>
            <Link to={`/cases/${d.legalCase}`}><Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>Back to case</Button></Link>
            <a href={documentApi.downloadUrl(id, selected)}><Button icon={<Download className="h-4 w-4" />}>Download v{selected}</Button></a>
          </>
        } />
      {d.isDemo && (
        <div className="mb-5"><Alert kind="warning" title="Demonstration document">
          This PDF is a generated summary sheet for the demo, not the official judgment. It exists to show how hashing and verification work.
        </Alert></div>
      )}

      <div className="grid gap-5 xl:grid-cols-5">
        <Card padded={false} className="overflow-hidden xl:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Preview</h2>
            {versions.data && versions.data.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                Version
                <select className="input !w-auto !py-1" value={selected} onChange={(e) => setVersion(Number(e.target.value))}>
                  {versions.data.map((v) => <option key={v._id} value={v.version}>v{v.version}</option>)}
                </select>
              </label>
            )}
          </div>
          {previewError ? <div className="p-4"><ErrorState message={previewError} /></div>
            : !blob ? <Spinner label="Loading preview" />
            : <iframe title={`PDF preview of ${d.title}`} src={blob} className="h-[640px] w-full bg-slate-100" />}
        </Card>

        <div className="space-y-5 xl:col-span-2">
          <VerificationPanel documentId={id} version={selected} onDone={records.reload} />
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Link2 className="h-4 w-4" aria-hidden /> Blockchain records</h2>
              {canRegister && unconfirmed && <Button size="sm" onClick={register} loading={registering}>Retry registration</Button>}
            </div>
            {records.loading && !records.data ? <Spinner /> : records.error ? <ErrorState message={records.error} onRetry={records.reload} />
              : records.data && records.data.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {records.data.map((r) => (
                    <li key={r._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">Version {r.version}</span><ChainStatusBadge status={r.status} /></div>
                      <dl className="mt-2 space-y-1 text-xs text-slate-600">
                        <div className="flex gap-2"><dt className="w-16 shrink-0">Hash</dt><dd><HashText value={r.contentHash} /></dd></div>
                        <div className="flex gap-2"><dt className="w-16 shrink-0">Tx</dt><dd><HashText value={r.txHash} /></dd></div>
                        {r.blockNumber !== undefined && <div className="flex gap-2"><dt className="w-16 shrink-0">Block</dt><dd>{r.blockNumber}</dd></div>}
                        {r.chainTimestamp && <div className="flex gap-2"><dt className="w-16 shrink-0">Time</dt><dd>{formatDate(r.chainTimestamp, true)}</dd></div>}
                        {r.error && canRegister && <div className="text-red-700">{r.error}</div>}
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-500">This document has no blockchain registration yet.</p>}
          </Card>
        </div>
      </div>

      {versions.data && versions.data.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Version history</h2>
          <Table headers={['Version', 'File', 'Size', 'SHA-256', 'Uploaded by', 'Uploaded']} caption="Document versions">
            {versions.data.map((v) => (
              <tr key={v._id}>
                <Td>v{v.version}</Td><Td>{v.safeName}</Td><Td>{formatBytes(v.size)}</Td>
                <Td><HashText value={v.sha256} /></Td><Td>{personName(v.uploadedBy)}</Td><Td>{formatDate(v.createdAt, true)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </>
  );
}
