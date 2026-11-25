import { FileUp, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChainStatusBadge } from '../../components/badges';
import { Alert, Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { caseApi, documentApi } from '../../services/endpoints';
import type { ChainRecord } from '../../types';
import { formatBytes } from '../../utils/format';

const MAX_MB = 10;

export default function UploadDocuments() {
  const { id = '' } = useParams();
  const toast = useToast();
  const c = useAsync(() => caseApi.get(id), [id]);
  const docs = useAsync(() => documentApi.forCase(id), [id]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [target, setTarget] = useState(''); // '' = new document
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ version: number; chain: ChainRecord | null; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    setFileError(null);
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith('.pdf') || (f.type && f.type !== 'application/pdf')) {
      setFile(null);
      return setFileError('Only PDF files are accepted.');
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      return setFileError(`File is larger than ${MAX_MB} MB (${formatBytes(f.size)}).`);
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await documentApi.upload({ file, caseId: id, title: title || undefined, documentId: target || undefined });
      setLast({ version: res.version.version, chain: res.blockchain, name: res.document.title });
      res.blockchain?.status === 'CONFIRMED'
        ? toast.success('Uploaded and registered on the blockchain')
        : toast.info('Uploaded. Blockchain registration is not confirmed yet; you can retry from the document page.');
      setFile(null);
      setTitle('');
      if (input.current) input.current.value = '';
      docs.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (c.loading && !c.data) return <Spinner />;
  if (c.error || !c.data) return <ErrorState message={c.error ?? 'Case not found'} onRetry={c.reload} />;

  return (
    <>
      <PageHeader title="Upload legal documents" description={<>For <Link className="text-navy-700 underline" to={`/cases/${id}`}>{c.data.title}</Link>. PDF only, up to {MAX_MB} MB.</>} />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="text-lg font-semibold">New upload</h2>
          <div className="mt-4 space-y-4">
            <SelectField label="Upload as" value={target} onChange={(e) => setTarget(e.target.value)}
              hint="A new version never overwrites earlier versions; each one gets its own blockchain record.">
              <option value="">A new document</option>
              {docs.data?.map((d) => <option key={d._id} value={d._id}>New version of "{d.title}" (currently v{d.currentVersion})</option>)}
            </SelectField>
            {!target && <TextField label="Document title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the case title" maxLength={300} />}
            <div>
              <label htmlFor="pdf" className="label">PDF file</label>
              <button type="button" onClick={() => input.current?.click()}
                className="flex w-full flex-col items-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-sm text-slate-600 hover:border-navy-400 hover:bg-navy-50">
                <UploadCloud className="mb-2 h-7 w-7 text-navy-500" aria-hidden />
                {file ? <span className="font-medium text-slate-800">{file.name} ({formatBytes(file.size)})</span> : 'Click to choose a PDF'}
              </button>
              <input id="pdf" ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              {fileError && <p role="alert" className="mt-1 text-xs text-red-600">{fileError}</p>}
            </div>
            <Button onClick={upload} disabled={!file} loading={busy} icon={<FileUp className="h-4 w-4" />}>Upload and register hash</Button>
          </div>
          {last && (
            <div className="mt-5">
              <Alert kind={last.chain?.status === 'CONFIRMED' ? 'success' : 'warning'} title={`${last.name}: version ${last.version} stored`}>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {last.chain ? <ChainStatusBadge status={last.chain.status} /> : 'No blockchain record'}
                  {last.chain?.error && <span className="text-xs">{last.chain.error}</span>}
                </div>
              </Alert>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Documents on this case</h2>
          {docs.loading && !docs.data ? <Spinner /> : docs.data && docs.data.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {docs.data.map((d) => (
                <li key={d._id} className="flex items-center justify-between gap-2 py-2.5">
                  <span>{d.title}<span className="block text-xs text-slate-500">Version {d.currentVersion}</span></span>
                  <Link to={`/documents/${d._id}`} className="text-navy-700 underline">Open</Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-500">No documents yet.</p>}
        </Card>
      </div>
    </>
  );
}
