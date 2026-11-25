import { CheckCircle2, ClipboardList, FilePlus2, FileText, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CaseCard } from '../../components/CaseCard';
import { Alert, Button, Card, ErrorState, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { statsApi } from '../../services/endpoints';
import { titleCase } from '../../utils/format';

const COLORS: Record<string, string> = { DRAFT: '#94a3b8', PENDING: '#d97706', PUBLISHED: '#059669', REJECTED: '#dc2626', ARCHIVED: '#64748b' };

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => statsApi.dashboard(), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Spinner label="Loading dashboard" />;

  const chart = Object.entries(data.casesByStatus as Record<string, number>).map(([status, count]) => ({ status: titleCase(status), key: status, count }));
  const attention = data.needsAttention as { _id: string; title: string; reviewNote?: string }[];

  return (
    <>
      <PageHeader title={`Welcome, ${user!.name.split(' ').slice(0, 2).join(' ')}`} description="Manage your case records and document integrity."
        actions={<Link to="/faculty/cases/new"><Button icon={<FilePlus2 className="h-4 w-4" />}>Add case</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My cases" value={data.stats.myCases} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="My documents" value={data.stats.myDocuments} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Confirmed on-chain" value={data.stats.chainConfirmed} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Awaiting confirmation" value={data.stats.chainUnconfirmed} icon={<ShieldAlert className="h-5 w-5" />} hint="Submitted, failed or pending" />
      </div>

      {attention.length > 0 && (
        <div className="mt-5 space-y-2">
          {attention.map((c) => (
            <Alert key={c._id} kind="warning" title={`Returned: ${c.title}`} action={<Link to={`/faculty/cases/${c._id}/edit`}><Button size="sm" variant="secondary">Revise</Button></Link>}>
              {c.reviewNote ?? 'The reviewer asked for changes.'}
            </Alert>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Cases by status</h2>
          {chart.length === 0 ? <p className="mt-3 text-sm text-slate-500">You have not created any cases yet.</p> : (
            <div className="mt-4 h-56" role="img" aria-label={`Cases by status: ${chart.map((c) => `${c.status} ${c.count}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f1f5fa' }} />
                  <Bar dataKey="count" name="Cases" radius={[4, 4, 0, 0]}>{chart.map((c) => <Cell key={c.key} fill={COLORS[c.key] ?? '#274570'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Quick actions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-navy-700 underline" to="/faculty/submissions">Review my submissions</Link></li>
            <li><Link className="text-navy-700 underline" to="/faculty/verifications">Document verification history</Link></li>
            <li><Link className="text-navy-700 underline" to="/faculty/audit-logs">Audit logs for my records</Link></li>
            <li><Link className="text-navy-700 underline" to="/cases?mine=true">Browse my cases</Link></li>
          </ul>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Recently updated</h2>
      <div className="space-y-3">{data.recentCases.map((c: never) => <CaseCard key={(c as { _id: string })._id} c={c} showStatus />)}</div>
    </>
  );
}
