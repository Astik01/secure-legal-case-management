import { AlertTriangle, ClipboardCheck, Layers, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CaseStatusBadge } from '../../components/badges';
import { Button, Card, EmptyState, ErrorState, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { statsApi } from '../../services/endpoints';
import { formatDate, personName } from '../../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAsync(() => statsApi.dashboard(), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Spinner label="Loading dashboard" />;
  const queue = data.pendingQueue as { _id: string; title: string; caseNumber: string; submittedAt?: string; createdBy: { name: string } }[];
  const byStatus = data.casesByStatus as Record<string, number>;

  return (
    <>
      <PageHeader title="Administration" description="Oversee users, content approvals and document integrity."
        actions={<Link to="/admin/analytics"><Button variant="secondary">View analytics</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active users" value={data.stats.activeUsers} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Total cases" value={data.stats.totalCases} icon={<Layers className="h-5 w-5" />} />
        <StatCard label="Pending approvals" value={data.stats.pendingApprovals} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Blockchain attention" value={data.stats.chainAttention} icon={<AlertTriangle className="h-5 w-5" />} hint="Failed or unsubmitted registrations" />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Approval queue</h2>
            <Link to="/admin/approvals" className="text-sm text-navy-700 underline">Open queue</Link>
          </div>
          {queue.length === 0 ? <div className="mt-3"><EmptyState title="Nothing waiting for review" /></div> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {queue.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 py-3">
                  <div><Link to={`/cases/${c._id}`} className="font-medium text-navy-800 hover:underline">{c.title}</Link>
                    <p className="text-xs text-slate-500">{c.caseNumber} · submitted by {personName(c.createdBy)} on {formatDate(c.submittedAt)}</p></div>
                  <Link to={`/cases/${c._id}`}><Button size="sm">Review</Button></Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Cases by status</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(byStatus).map(([s, n]) => (
              <li key={s} className="flex items-center justify-between text-sm"><CaseStatusBadge status={s as never} /><span className="font-semibold">{n}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
