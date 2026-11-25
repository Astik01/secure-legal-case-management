import { BookMarked, BookOpen, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CaseCard } from '../../components/CaseCard';
import { Button, Card, EmptyState, ErrorState, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { statsApi } from '../../services/endpoints';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => statsApi.dashboard(), []);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Spinner label="Loading dashboard" />;

  const categories = Object.entries(data.categories as Record<string, number>).map(([name, count]) => ({ name, count }));

  return (
    <>
      <PageHeader title={`Welcome, ${user!.name.split(' ')[0]}`} description="Your research workspace."
        actions={<Link to="/cases"><Button icon={<BookOpen className="h-4 w-4" />}>Browse cases</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Published cases" value={data.stats.publishedCases} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Bookmarks" value={data.stats.bookmarks} icon={<BookMarked className="h-5 w-5" />} />
        <StatCard label="Verifications run" value={data.stats.verifications} icon={<ShieldCheck className="h-5 w-5" />} hint="Document integrity checks" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="text-lg font-semibold">Cases by category</h2>
          {categories.length === 0 ? <p className="mt-3 text-sm text-slate-500">No published cases yet.</p> : (
            <div className="mt-4 h-64" role="img" aria-label={`Bar chart of published cases by category: ${categories.map((c) => `${c.name} ${c.count}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f1f5fa' }} />
                  <Bar dataKey="count" fill="#274570" radius={[4, 4, 0, 0]} name="Cases" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold">How to verify a document</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Open a case and choose <strong>View and verify</strong> on a document.</li>
            <li>Run the integrity check to compare its fingerprint with the blockchain record.</li>
            <li>Or upload a copy you downloaded earlier to check that it is unchanged.</li>
          </ol>
          <Link to="/verify" className="mt-4 inline-block text-sm font-medium text-navy-700 underline">See your verification history</Link>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Recently updated cases</h2>
      {data.recentCases.length === 0 ? <EmptyState title="Nothing to show yet" /> : (
        <div className="space-y-3">{data.recentCases.map((c: never) => <CaseCard key={(c as { _id: string })._id} c={c} />)}</div>
      )}
    </>
  );
}
