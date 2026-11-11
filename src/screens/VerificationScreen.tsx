import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Loading, MetalBadge, PageHeader, SourceBadge, StatusBadge } from '../components/ui';
import { Thumb } from './DashboardScreen';
import { dateTime, grams } from '../format';
import type { Article } from '../types';

export default function VerificationScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Article[] | null>(null);
  const [returned, setReturned] = useState<Article[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<Article[]>('/articles?status=pending').then((r) => setRows([...r].reverse())).catch((e) => setErr(e.message));
    api.get<Article[]>('/articles?status=returned').then(setReturned).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Verification queue" kn="ಪರಿಶೀಲನಾ ಸರತಿ" subtitle="Oldest first. Open an entry, check the physical article, then approve or return it." />
      <ErrorBox>{err}</ErrorBox>
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="Nothing waiting for verification">New registrations will appear here.</Empty> : (
        <div className="grid gap-4 tablet:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const own = a.created_by === user?.id || a.updated_by === user?.id;
            return (
              <Link key={a.id} to={`/articles/${a.article_no}`} className={`card p-4 hover:shadow-glow transition animate-rise ${own ? 'opacity-60' : ''}`}>
                <div className="flex gap-4">
                  <Thumb a={a} size="w-20 h-20" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-maroon-800">{a.article_no}</div>
                    <div className="truncate text-sm">{a.description}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5"><MetalBadge metal={a.metal} /><SourceBadge source={a.source} /></div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-charcoal/60">by {a.created_by_name} · {dateTime(a.created_at)}</span>
                  <b className="tabular">{grams(a.gross_weight)}</b>
                </div>
                {a.photo_count === 0 && <div className="mt-2 text-xs font-semibold text-amber-700">No photo attached</div>}
                {own && <div className="mt-2 text-xs font-semibold text-charcoal/60">Your own entry: another officer must verify</div>}
              </Link>
            );
          })}
        </div>
      )}
      {returned.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-3">Returned, waiting for correction ({returned.length})</h2>
          <div className="card divide-y divide-cream-200">
            {returned.map((a) => (
              <Link key={a.id} to={`/articles/${a.article_no}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-cream-50">
                <span className="font-mono font-bold text-maroon-800">{a.article_no}</span><StatusBadge status={a.status} />
                <span className="truncate text-sm text-charcoal/70 flex-1">{a.return_remarks}</span>
                <span className="text-xs text-charcoal/50">{a.created_by_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
