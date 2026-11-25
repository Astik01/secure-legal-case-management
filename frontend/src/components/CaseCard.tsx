import { Calendar, Landmark, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LegalCase } from '../types';
import { CaseStatusBadge } from './badges';
import { Badge } from './ui';

export function CaseCard({ c, showStatus = false }: { c: LegalCase; showStatus?: boolean }) {
  return (
    <article className="card p-5 transition hover:border-navy-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-navy-900">
          <Link to={`/cases/${c._id}`} className="hover:underline">{c.title}</Link>
        </h3>
        <div className="flex items-center gap-2">
          {showStatus && <CaseStatusBadge status={c.status} />}
          <Badge tone="blue">{c.category}</Badge>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">{c.citation ?? c.caseNumber}</p>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.summary}</p>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <div className="flex items-center gap-1"><Landmark className="h-3.5 w-3.5" aria-hidden /><dt className="sr-only">Court</dt><dd>{c.court}</dd></div>
        <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden /><dt className="sr-only">Year</dt><dd>{c.year}</dd></div>
        {(c.tags?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" aria-hidden /><dt className="sr-only">Tags</dt><dd>{(c.tags ?? []).slice(0, 3).join(', ')}</dd></div>
        )}
      </dl>
    </article>
  );
}
