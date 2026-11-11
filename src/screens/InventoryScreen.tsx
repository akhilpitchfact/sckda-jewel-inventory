import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useI18n } from '../i18n';
import { Empty, ErrorBox, Icon, Loading, MetalBadge, PageHeader, SourceBadge, StatusBadge } from '../components/ui';
import { Thumb } from './DashboardScreen';
import { dateTime, grams, gramsShort, int, istDayEnd, istDayStart } from '../format';
import type { Article, Category } from '../types';

export default function InventoryScreen() {
  const [sp, setSp] = useSearchParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [rows, setRows] = useState<Article[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [err, setErr] = useState('');
  const [view, setView] = useState<'table' | 'cards'>(() => (window.innerWidth < 900 ? 'cards' : 'table'));
  const [searchDraft, setSearchDraft] = useState(sp.get('search') || '');

  const filters = {
    search: sp.get('search') || '', metal: sp.get('metal') || '', source: sp.get('source') || '', status: sp.get('status') || '',
    category_id: sp.get('category_id') || '', from: sp.get('from') || '', to: sp.get('to') || '',
    minWeight: sp.get('minWeight') || '', maxWeight: sp.get('maxWeight') || '', mine: sp.get('mine') || '',
  };
  const setFilter = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k === 'metal') n.delete('category_id');
    setSp(n, { replace: true });
  };

  useEffect(() => { api.get<Category[]>('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    const id = setTimeout(() => { if (searchDraft !== filters.search) setFilter('search', searchDraft); }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);
  useEffect(() => {
    setRows(null);
    api.get<Article[]>(`/articles${qs({
      search: filters.search, metal: filters.metal, source: filters.source, status: filters.status, category_id: filters.category_id,
      from: filters.from ? istDayStart(filters.from) : '', to: filters.to ? istDayEnd(filters.to) : '',
      minWeight: filters.minWeight, maxWeight: filters.maxWeight, createdByMe: filters.mine ? '1' : '',
      includeCancelled: filters.status === 'cancelled' ? '1' : '',
    })}`).then(setRows).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  const totals = useMemo(() => {
    const r = rows || [];
    const by = (m: string) => r.filter((a) => a.metal === m).reduce((s, a) => ({ n: s.n + 1, pcs: s.pcs + a.quantity, g: s.g + a.gross_weight }), { n: 0, pcs: 0, g: 0 });
    return { gold: by('gold'), silver: by('silver') };
  }, [rows]);

  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader title="Inventory" kn="ದಾಸ್ತಾನು" subtitle="Every gold and silver article registered by the Authority"
        actions={<>
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-cream-200">
            {(['table', 'cards'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === v ? 'bg-maroon-700 text-white' : 'text-charcoal/60'}`}>{v === 'table' ? 'Table' : 'Cards'}</button>
            ))}
          </div>
        </>}
      />

      <div className="card p-4 mb-5 space-y-3">
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/40" />
          <input className="input pl-12" placeholder="Search article ID, description, receipt reference, donor…" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 tablet:grid-cols-4 lg:grid-cols-8">
          <select className="input !min-h-[42px] !py-2 text-sm" value={filters.metal} onChange={(e) => setFilter('metal', e.target.value)}>
            <option value="">{t('metal', 'Metal')}: {t('all', 'All')}</option><option value="gold">{t('gold', 'Gold')}</option><option value="silver">{t('silver', 'Silver')}</option>
          </select>
          <select className="input !min-h-[42px] !py-2 text-sm" value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
            <option value="">{t('source', 'Source')}: {t('all', 'All')}</option><option value="hundi">{t('hundi', 'Hundi')}</option><option value="seva">{t('seva', 'Seva')}</option>
          </select>
          <select className="input !min-h-[42px] !py-2 text-sm" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">{t('status', 'Status')}: {t('all', 'All')}</option>
            <option value="pending">Pending verification</option><option value="returned">Returned for correction</option>
            <option value="approved">Approved</option><option value="cancelled">Cancelled</option>
          </select>
          <select className="input !min-h-[42px] !py-2 text-sm" value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
            <option value="">{t('category', 'Category')}: {t('all', 'All')}</option>
            {cats.filter((c) => !filters.metal || c.metal === filters.metal).map((c) => <option key={c.id} value={c.id}>{lang === 'kn' && c.name_kn ? c.name_kn : c.name}</option>)}
          </select>
          <input type="date" title="From date" className="input !min-h-[42px] !py-2 text-sm" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          <input type="date" title="To date" className="input !min-h-[42px] !py-2 text-sm" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          <input type="number" placeholder="Min g" className="input !min-h-[42px] !py-2 text-sm" value={filters.minWeight} onChange={(e) => setFilter('minWeight', e.target.value)} />
          <input type="number" placeholder="Max g" className="input !min-h-[42px] !py-2 text-sm" value={filters.maxWeight} onChange={(e) => setFilter('maxWeight', e.target.value)} />
        </div>
        {anyFilter && <button type="button" className="text-sm font-semibold text-maroon-700 hover:underline" onClick={() => { setSearchDraft(''); setSp(new URLSearchParams(), { replace: true }); }}>Clear filters</button>}
      </div>

      <ErrorBox>{err}</ErrorBox>
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="No articles found">{anyFilter ? 'Try clearing some filters.' : 'Registered articles will appear here.'}</Empty> : (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="chip bg-white ring-1 ring-cream-200 px-3 py-1.5 text-sm">{int(rows.length)} records</span>
            {totals.gold.n > 0 && <span className="chip metal-gold text-maroon-950 px-3 py-1.5 text-sm">Gold: {int(totals.gold.pcs)} pc · {gramsShort(totals.gold.g)}</span>}
            {totals.silver.n > 0 && <span className="chip metal-silver text-charcoal px-3 py-1.5 text-sm ring-1 ring-silver-300">Silver: {int(totals.silver.pcs)} pc · {gramsShort(totals.silver.g)}</span>}
          </div>

          {view === 'cards' ? (
            <div className="grid gap-4 tablet:grid-cols-2 xl:grid-cols-3">
              {rows.map((a) => (
                <Link key={a.id} to={`/articles/${a.article_no}`} className="card overflow-hidden hover:shadow-glow transition animate-rise">
                  <div className="flex gap-4 p-4">
                    <Thumb a={a} size="w-20 h-20" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-bold text-maroon-800">{a.article_no}</div>
                      <div className="truncate text-sm">{a.description}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5"><MetalBadge metal={a.metal} /><SourceBadge source={a.source} /><StatusBadge status={a.status} /></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-cream-200 bg-cream-50 px-4 py-2 text-sm">
                    <span className="text-charcoal/60">{dateTime(a.received_at)}</span>
                    <span><b className="tabular">{grams(a.gross_weight)}</b> · {a.quantity} pc</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-x">
                <thead><tr>
                  <th></th><th>{t('articleId', 'Article ID')}</th><th>Received</th><th>{t('category', 'Category')}</th><th>{t('description', 'Description')}</th>
                  <th>{t('source', 'Source')}</th><th className="text-right">Qty</th><th className="text-right">Gross (g)</th><th className="text-right">Net (g)</th><th>{t('status', 'Status')}</th>
                </tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="cursor-pointer" onClick={() => nav(`/articles/${a.article_no}`)}>
                      <td className="w-12"><Thumb a={a} size="w-10 h-10" /></td>
                      <td className="font-mono font-bold text-maroon-800 whitespace-nowrap">{a.article_no}</td>
                      <td className="whitespace-nowrap text-charcoal/70">{dateTime(a.received_at)}</td>
                      <td className="whitespace-nowrap"><MetalBadge metal={a.metal} /> <span className="ml-1">{lang === 'kn' && a.category_name_kn ? a.category_name_kn : a.category_name}</span></td>
                      <td className="max-w-xs truncate">{a.description}</td>
                      <td><SourceBadge source={a.source} />{a.receipt_ref && <div className="text-xs text-charcoal/50">{a.receipt_ref}</div>}</td>
                      <td className="text-right tabular">{a.quantity}</td>
                      <td className="text-right tabular font-semibold">{a.gross_weight.toFixed(3)}</td>
                      <td className="text-right tabular text-charcoal/70">{a.net_weight?.toFixed(3) ?? '—'}</td>
                      <td><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
