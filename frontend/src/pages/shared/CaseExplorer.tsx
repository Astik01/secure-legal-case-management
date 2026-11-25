import { Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CaseCard } from '../../components/CaseCard';
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { caseApi } from '../../services/endpoints';
import { CASE_CATEGORIES } from '../../types';

const SORTS = [
  ['recent', 'Recently added'], ['year_desc', 'Year (newest)'], ['year_asc', 'Year (oldest)'], ['title', 'Title (A-Z)'],
] as const;

export default function CaseExplorer() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q);
  const isStaff = user!.role !== 'STUDENT';

  const get = (k: string) => params.get(k) ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedQ !== get('q')) set('q', debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const filters = useAsync(() => caseApi.filters(), []);
  const query = Object.fromEntries(params.entries());
  const { data, loading, error, reload } = useAsync(() => caseApi.list({ limit: 10, ...query }), [params.toString()]);

  const hasFilters = ['q', 'court', 'year', 'category', 'status', 'mine'].some((k) => params.get(k));

  return (
    <>
      <PageHeader title="Case explorer" description="Search and filter legal cases by title, case number, court, year and category." />
      <Card className="mb-5">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-3">
            <label htmlFor="q" className="label">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input id="q" className="input pl-9" placeholder="Title, case number, party, keyword" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="court" className="label">Court</label>
            <select id="court" className="input" value={get('court')} onChange={(e) => set('court', e.target.value)}>
              <option value="">All courts</option>
              {filters.data?.courts.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="year" className="label">Year</label>
            <select id="year" className="input" value={get('year')} onChange={(e) => set('year', e.target.value)}>
              <option value="">Any year</option>
              {filters.data?.years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="category" className="label">Category</label>
            <select id="category" className="input" value={get('category')} onChange={(e) => set('category', e.target.value)}>
              <option value="">All categories</option>
              {CASE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {isStaff && (
            <>
              <div className="md:col-span-2">
                <label htmlFor="status" className="label">Status</label>
                <select id="status" className="input" value={get('status')} onChange={(e) => set('status', e.target.value)}>
                  <option value="">All visible statuses</option>
                  {['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {user!.role === 'FACULTY' && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 md:col-span-2">
                  <input type="checkbox" checked={get('mine') === 'true'} onChange={(e) => set('mine', e.target.checked ? 'true' : '')} />
                  Only my cases
                </label>
              )}
            </>
          )}
          <div className="md:col-span-2">
            <label htmlFor="sort" className="label">Sort by</label>
            <select id="sort" className="input" value={get('sort') || 'recent'} onChange={(e) => set('sort', e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {hasFilters && (
            <div className="self-end md:col-span-1">
              <Button type="button" variant="ghost" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</Button>
            </div>
          )}
        </form>
      </Card>

      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner label="Loading cases" />
        : data && data.items.length === 0 ? (
          <EmptyState icon={<SearchX className="h-10 w-10" />} title="No cases match your search"
            description={hasFilters ? 'Try removing a filter or searching for a different term.' : 'No cases have been published yet.'} />
        ) : data ? (
          <div aria-busy={loading} className={loading ? 'opacity-60 transition' : 'transition'}>
            <p className="sr-only" role="status">{data.meta.total} cases found</p>
            <div className="space-y-3">{data.items.map((c) => <CaseCard key={c._id} c={c} showStatus={isStaff} />)}</div>
            <div className="mt-5"><Pagination meta={data.meta} onPage={(p) => set('page', String(p))} /></div>
          </div>
        ) : null}
    </>
  );
}
