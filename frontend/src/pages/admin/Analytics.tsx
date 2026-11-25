import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, ErrorState, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { statsApi } from '../../services/endpoints';
import { titleCase } from '../../utils/format';

// Colour-blind-safe categorical palette; meaning is also carried by labels, not colour alone.
const PALETTE = ['#274570', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569'];
const toRows = (o: Record<string, number> = {}) => Object.entries(o).map(([name, value]) => ({ name: titleCase(name), value }));

function ChartCard({ title, rows, children, summary }: { title: string; rows: unknown[]; children: React.ReactNode; summary: string }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">No data yet.</p> : (
        <div className="mt-3 h-60" role="img" aria-label={summary}>{children}</div>
      )}
    </Card>
  );
}

export default function Analytics() {
  const { data: d, loading, error, reload } = useAsync(() => statsApi.analytics(), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !d) return <Spinner label="Loading analytics" />;

  const roles = toRows(d.users.byRole);
  const status = toRows(d.cases.byStatus);
  const categories = toRows(d.cases.byCategory);
  const chain = toRows(d.blockchain.byStatus);
  const verifs = toRows(d.verifications.last30Days);
  const sum = (rows: { name: string; value: number }[]) => rows.map((r) => `${r.name} ${r.value}`).join(', ');

  return (
    <>
      <PageHeader title="Analytics" description="System-wide usage, content and integrity metrics." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={d.users.total} />
        <StatCard label="Cases" value={d.cases.total} />
        <StatCard label="Documents" value={d.documents.total} hint={`${d.documents.versions} versions stored`} />
        <StatCard label="Denied requests (30 days)" value={d.security.deniedRequestsLast30Days} hint={`${d.security.failedLoginsLast30Days} failed sign-ins`} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Users by role" rows={roles} summary={`Users by role: ${sum(roles)}`}>
          <ResponsiveContainer><PieChart><Pie data={roles} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label>
            {roles.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cases by status" rows={status} summary={`Cases by status: ${sum(status)}`}>
          <ResponsiveContainer><BarChart data={status} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip />
            <Bar dataKey="value" name="Cases" fill="#274570" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cases by category" rows={categories} summary={`Cases by category: ${sum(categories)}`}>
          <ResponsiveContainer><BarChart data={categories} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip />
            <Bar dataKey="value" name="Cases" fill="#0f766e" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cases by decision year" rows={d.cases.byYear} summary={`Cases by year: ${d.cases.byYear.map((y: { year: number; count: number }) => `${y.year} ${y.count}`).join(', ')}`}>
          <ResponsiveContainer><BarChart data={d.cases.byYear} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip />
            <Bar dataKey="count" name="Cases" fill="#b45309" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Blockchain registrations" rows={chain} summary={`Blockchain registrations: ${sum(chain)}`}>
          <ResponsiveContainer><PieChart><Pie data={chain} dataKey="value" nameKey="name" outerRadius={85} label>
            {chain.map((_, i) => <Cell key={i} fill={PALETTE[(i + 1) % PALETTE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Verification outcomes (30 days)" rows={verifs} summary={`Verification outcomes: ${sum(verifs)}`}>
          <ResponsiveContainer><BarChart data={verifs} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip />
            <Bar dataKey="value" name="Checks" radius={[4, 4, 0, 0]}>{verifs.map((v, i) => <Cell key={i} fill={v.name === 'Verified' ? '#059669' : v.name === 'Tampered' ? '#dc2626' : '#64748b'} />)}</Bar></BarChart></ResponsiveContainer>
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard title="Activity (last 14 days)" rows={d.activityLast14Days} summary="Audit events per day over the last 14 days">
            <ResponsiveContainer><LineChart data={d.activityLast14Days} margin={{ left: -20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip />
              <Line type="monotone" dataKey="count" name="Events" stroke="#274570" strokeWidth={2} dot /></LineChart></ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </>
  );
}
