import { ScrollText } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Alert, Badge, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Table, Td } from '../../components/ui';
import type { Tone } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { auditApi } from '../../services/endpoints';
import { formatDate, titleCase } from '../../utils/format';

const outcomeTone: Record<string, Tone> = { SUCCESS: 'green', FAILURE: 'amber', DENIED: 'red' };

export default function AuditLogs() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ action: '', outcome: '', from: '', to: '' });
  const [open, setOpen] = useState<string | null>(null);
  const actions = useAsync(() => auditApi.actions(), []);
  const params = {
    page, limit: 20,
    ...(f.action ? { action: f.action } : {}), ...(f.outcome ? { outcome: f.outcome } : {}),
    ...(f.from ? { from: new Date(f.from).toISOString() } : {}),
    ...(f.to ? { to: new Date(`${f.to}T23:59:59`).toISOString() } : {}),
  };
  const { data, loading, error, reload } = useAsync(() => auditApi.list(params), [JSON.stringify(params)]);
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(1); };

  return (
    <>
      <PageHeader title="Audit logs"
        description={user!.role === 'ADMIN' ? 'All recorded application activity.' : 'Your actions and activity on the cases and documents you own.'} />
      <div className="mb-5">
        <Alert kind="info" title="About this audit trail">
          These entries are stored in the application database and are append-only through the application. They are not recorded on the blockchain;
          only document hashes are anchored on-chain.
        </Alert>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label htmlFor="a" className="label">Action</label>
          <select id="a" className="input" value={f.action} onChange={(e) => set('action', e.target.value)}>
            <option value="">All actions</option>{actions.data?.map((a) => <option key={a}>{a}</option>)}
          </select></div>
        <div><label htmlFor="o" className="label">Outcome</label>
          <select id="o" className="input" value={f.outcome} onChange={(e) => set('outcome', e.target.value)}>
            <option value="">All outcomes</option><option>SUCCESS</option><option>FAILURE</option><option>DENIED</option>
          </select></div>
        <div><label htmlFor="from" className="label">From</label><input id="from" type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} /></div>
        <div><label htmlFor="to" className="label">To</label><input id="to" type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} /></div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState icon={<ScrollText className="h-10 w-10" />} title="No audit entries match" />
        : data && (
          <div className="space-y-4">
            <Table headers={['Time', 'User', 'Action', 'Resource', 'Outcome', 'Details']} caption="Audit log entries">
              {data.items.map((e) => (
                <Fragment key={e._id}>
                  <tr>
                    <Td className="whitespace-nowrap">{formatDate(e.createdAt, true)}</Td>
                    <Td>{e.actor?.name ?? <span className="text-slate-400">anonymous</span>}<div className="text-xs text-slate-500">{e.actorRole ? titleCase(e.actorRole) : ''}</div></Td>
                    <Td><code className="text-xs">{e.action}</code></Td>
                    <Td className="text-xs">{e.resourceType ?? '-'}<div className="max-w-[140px] truncate font-mono text-slate-400" title={e.resourceId}>{e.resourceId}</div></Td>
                    <Td><Badge tone={outcomeTone[e.outcome]}>{e.outcome}</Badge></Td>
                    <Td>{e.metadata ? (
                      <button className="text-xs text-navy-700 underline" aria-expanded={open === e._id} onClick={() => setOpen(open === e._id ? null : e._id)}>
                        {open === e._id ? 'Hide' : 'Show'}
                      </button>) : '-'}</Td>
                  </tr>
                  {open === e._id && (
                    <tr className="bg-slate-50"><td colSpan={6} className="px-4 py-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-700">{JSON.stringify({ ...e.metadata, ip: e.ip }, null, 2)}</pre>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </Table>
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
    </>
  );
}
