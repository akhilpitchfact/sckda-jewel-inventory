import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, photoUrl } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { CountUp, Icon, Loading, Mandala, MetalBadge, SourceBadge, StatusBadge, ErrorBox } from '../components/ui';
import { dateTime, grams, gramsShort, int, monthLabel } from '../format';
import type { Article, Metal, Source, Status } from '../types';

interface Row { metal: Metal; source: Source; status: Status; entries: number; pieces: number; gross: number; net: number }
interface Stats {
  all: Row[]; today: Row[];
  monthly: { month: string; metal: Metal; entries: number; pieces: number; gross: number }[];
  byCategory: { metal: Metal; name: string; name_kn: string | null; entries: number; pieces: number; gross: number }[];
  recent: Article[];
  returnedToMe: number;
}

const sum = (rows: Row[], f: (r: Row) => boolean) => rows.filter(f).reduce(
  (a, r) => ({ entries: a.entries + r.entries, pieces: a.pieces + (r.pieces || 0), gross: a.gross + (r.gross || 0) }),
  { entries: 0, pieces: 0, gross: 0 },
);

export default function DashboardScreen() {
  const { user, can } = useAuth();
  const { t, lang } = useI18n();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = () => api.get<Stats>('/stats').then(setS).catch((e) => setErr(e.message));
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const k = useMemo(() => {
    if (!s) return null;
    const A = s.all;
    const appr = (m: Metal) => sum(A, (r) => r.metal === m && r.status === 'approved');
    const pend = (m: Metal) => sum(A, (r) => r.metal === m && r.status !== 'approved');
    return {
      gold: appr('gold'), silver: appr('silver'), goldPend: pend('gold'), silverPend: pend('silver'),
      hundi: { gold: sum(A, (r) => r.source === 'hundi' && r.metal === 'gold'), silver: sum(A, (r) => r.source === 'hundi' && r.metal === 'silver') },
      seva: { gold: sum(A, (r) => r.source === 'seva' && r.metal === 'gold'), silver: sum(A, (r) => r.source === 'seva' && r.metal === 'silver') },
      pending: sum(A, (r) => r.status === 'pending'),
      returned: sum(A, (r) => r.status === 'returned'),
      approved: sum(A, (r) => r.status === 'approved'),
      today: sum(s.today, () => true),
      todayGold: sum(s.today, (r) => r.metal === 'gold'),
      todaySilver: sum(s.today, (r) => r.metal === 'silver'),
    };
  }, [s]);

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!s || !k) return <Loading />;

  const hour = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <section className="temple-bg relative overflow-hidden rounded-3xl px-6 py-7 tablet:px-8 text-white shadow-glow animate-rise">
        <Mandala className="pointer-events-none absolute -right-24 -top-24 w-96 h-96 text-gold-300/15 animate-spin-slower" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-gold-200/80">{greet}, {user?.name}</div>
            <h1 className="mt-1 py-1 text-2xl tablet:text-4xl font-bold leading-normal gold-text">{t('appName', 'Gold & Silver Inventory')}</h1>
            <div className="mt-1 text-sm text-white/60">{t('authority', 'Sri Chamundeshwari Kshetra Development Authority')}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('article.create') && <Link to="/new" className="btn-gold sheen"><Icon name="plus" />{t('newArticle', 'Register Article')}</Link>}
            {can('article.verify') && k.pending.entries > 0 && (
              <Link to="/verification" className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15">
                <Icon name="check" />{k.pending.entries} to verify
              </Link>
            )}
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { l: t('today', 'Today'), v: `${int(k.today.entries)} entries` },
            { l: `${t('gold', 'Gold')} · ${t('today', 'today')}`, v: gramsShort(k.todayGold.gross) },
            { l: `${t('silver', 'Silver')} · ${t('today', 'today')}`, v: gramsShort(k.todaySilver.gross) },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl bg-white/[0.06] px-2 py-3 ring-1 ring-white/10">
              <div className="text-[11px] uppercase tracking-wider text-gold-200/70">{x.l}</div>
              <div className="mt-0.5 text-lg tablet:text-xl font-bold tabular">{x.v}</div>
            </div>
          ))}
        </div>
      </section>

      {can('article.create') && s.returnedToMe > 0 && (
        <Link to="/inventory?status=returned&mine=1" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800 animate-rise">
          <Icon name="edit" />
          <span className="font-semibold">{s.returnedToMe} of your entries were returned for correction.</span>
          <span className="ml-auto text-sm underline">Open</span>
        </Link>
      )}

      {/* Gold & silver vault cards */}
      <section className="grid gap-5 md:grid-cols-2">
        <VaultCard metal="gold" title={t('totalGold', 'Total Gold')} data={k.gold} pending={k.goldPend} />
        <VaultCard metal="silver" title={t('totalSilver', 'Total Silver')} data={k.silver} pending={k.silverPend} />
      </section>

      {/* Source + status tiles */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SourceTile label={t('hundiCollections', 'Hundi Collections')} d={k.hundi} tone="maroon" />
        <SourceTile label={t('sevaCollections', 'Seva Collections')} d={k.seva} tone="saffron" />
        <StatTile label={t('pendingVerification', 'Pending Verification')} value={k.pending.entries} sub={k.returned.entries ? `+ ${k.returned.entries} returned for correction` : 'records awaiting a verifier'} icon="audit" tone="amber" to={can('article.verify') ? '/verification' : '/inventory?status=pending'} />
        <StatTile label={t('approvedArticles', 'Approved Articles')} value={k.approved.entries} sub={`${int(k.approved.pieces)} pieces verified`} icon="check" tone="emerald" to="/inventory?status=approved" />
      </section>

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3 animate-rise">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{t('receiptsOverTime', 'Receipts by month')}</h2>
            <span className="text-xs text-charcoal/50">Gross weight, last 12 months</span>
          </div>
          <MonthlyChart data={s.monthly} />
        </div>
        <div className="card p-5 lg:col-span-2 animate-rise">
          <h2 className="section-title">{t('byCategory', 'Inventory by category')}</h2>
          <CategoryBars rows={s.byCategory} lang={lang} />
        </div>
      </section>

      {/* Recent */}
      <section className="card p-5 animate-rise">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">{t('recentEntries', 'Recent entries')}</h2>
          <Link to="/inventory" className="text-sm font-semibold text-maroon-700 hover:underline">View all</Link>
        </div>
        {s.recent.length === 0 ? <div className="py-8 text-center text-charcoal/50">No articles registered yet.</div> : (
          <div className="divide-y divide-cream-200">
            {s.recent.map((a) => (
              <Link key={a.id} to={`/articles/${a.article_no}`} className="flex items-center gap-4 py-3 hover:bg-cream-50 -mx-2 px-2 rounded-xl transition">
                <Thumb a={a} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-maroon-800">{a.article_no}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="truncate text-sm text-charcoal/80">{a.description}</div>
                  <div className="text-xs text-charcoal/50">{dateTime(a.received_at)} · <SourceBadge source={a.source} /></div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular">{grams(a.gross_weight)}</div>
                  <div className="text-xs text-charcoal/50">{a.quantity} pc</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function Thumb({ a, size = 'w-14 h-14' }: { a: Pick<Article, 'cover_photo_id' | 'metal'>; size?: string }) {
  return a.cover_photo_id ? (
    <img src={photoUrl(a.cover_photo_id)} alt="" loading="lazy" className={`${size} shrink-0 rounded-xl object-cover ring-2 ${a.metal === 'gold' ? 'ring-gold-300' : 'ring-silver-300'}`} />
  ) : (
    <div className={`${size} shrink-0 rounded-xl grid place-items-center ${a.metal === 'gold' ? 'metal-gold text-gold-800' : 'metal-silver text-silver-700'}`}>
      <Icon name="image" className="w-5 h-5 opacity-60" />
    </div>
  );
}

function VaultCard({ metal, title, data, pending }: { metal: Metal; title: string; data: { entries: number; pieces: number; gross: number }; pending: { entries: number; pieces: number; gross: number } }) {
  const gold = metal === 'gold';
  const kg = data.gross >= 1000;
  return (
    <div className={`sheen relative overflow-hidden rounded-3xl p-6 shadow-glow animate-rise ${gold ? 'metal-gold text-maroon-950' : 'metal-silver text-charcoal'}`}>
      <Mandala className={`pointer-events-none absolute -right-16 -bottom-16 w-72 h-72 ${gold ? 'text-gold-800/20' : 'text-silver-700/20'}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-sm font-bold uppercase tracking-[.2em] opacity-70">{title}</div>
          <div className="mt-0.5 text-xs opacity-60">Verified inventory</div>
        </div>
        <span className={`grid place-items-center w-11 h-11 rounded-2xl ${gold ? 'bg-maroon-900 text-gold-200' : 'bg-silver-700 text-white'} shadow-lg`}>
          <Icon name="scale" />
        </span>
      </div>
      <div className="relative mt-5 flex items-baseline gap-2">
        <span className="text-5xl tablet:text-6xl font-bold tabular tracking-tight">
          <CountUp value={kg ? data.gross / 1000 : data.gross} decimals={3} />
        </span>
        <span className="text-xl font-bold opacity-70">{kg ? 'kg' : 'g'}</span>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-white/35 px-3 py-2 backdrop-blur-sm"><div className="text-[11px] font-semibold uppercase opacity-60">Pieces</div><div className="text-lg font-bold tabular"><CountUp value={data.pieces} /></div></div>
        <div className="rounded-xl bg-white/35 px-3 py-2 backdrop-blur-sm"><div className="text-[11px] font-semibold uppercase opacity-60">Records</div><div className="text-lg font-bold tabular"><CountUp value={data.entries} /></div></div>
        <div className="rounded-xl bg-white/35 px-3 py-2 backdrop-blur-sm"><div className="text-[11px] font-semibold uppercase opacity-60">Pending</div><div className="text-lg font-bold tabular">{gramsShort(pending.gross)}</div></div>
      </div>
    </div>
  );
}

function SourceTile({ label, d, tone }: { label: string; d: { gold: { pieces: number; gross: number }; silver: { pieces: number; gross: number } }; tone: 'maroon' | 'saffron' }) {
  return (
    <div className="card p-4 animate-rise">
      <div className={`text-xs font-bold uppercase tracking-wider ${tone === 'maroon' ? 'text-maroon-700' : 'text-saffron-700'}`}>{label}</div>
      <div className="mt-3 space-y-2">
        {(['gold', 'silver'] as const).map((m) => (
          <div key={m} className="flex items-center justify-between gap-2">
            <MetalBadge metal={m} />
            <div className="text-right">
              <div className="text-sm font-bold tabular">{gramsShort(d[m].gross)}</div>
              <div className="text-[11px] text-charcoal/50">{int(d[m].pieces)} pieces</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, icon, tone, to }: { label: string; value: number; sub: string; icon: string; tone: 'amber' | 'emerald'; to: string }) {
  const c = tone === 'amber' ? 'from-amber-400 to-amber-600' : 'from-emerald-400 to-emerald-700';
  return (
    <Link to={to} className="card p-4 animate-rise hover:shadow-glow transition group">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-charcoal/60">{label}</div>
        <span className={`grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br ${c} text-white shadow`}><Icon name={icon} className="w-[18px] h-[18px]" /></span>
      </div>
      <div className="mt-2 text-4xl font-bold tabular text-charcoal"><CountUp value={value} /></div>
      <div className="text-xs text-charcoal/50">{sub}</div>
    </Link>
  );
}

function MonthlyChart({ data }: { data: Stats['monthly'] }) {
  const months: string[] = [];
  const now = new Date(Date.now() + 330 * 60_000);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const g = (m: string, metal: Metal) => data.find((d) => d.month === m && d.metal === metal)?.gross || 0;
  const maxG = Math.max(1, ...months.map((m) => g(m, 'gold')));
  const maxS = Math.max(1, ...months.map((m) => g(m, 'silver')));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <div className="flex gap-4 text-xs mb-3">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded metal-gold" />Gold (own scale)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded metal-silver ring-1 ring-silver-300" />Silver (own scale)</span>
      </div>
      <div className="relative flex h-52 items-end gap-1.5 tablet:gap-2.5 border-b border-cream-300">
        {months.map((m) => {
          const gv = g(m, 'gold'); const sv = g(m, 'silver');
          return (
            <div key={m} className="relative flex h-full flex-1 items-end justify-center gap-0.5 tablet:gap-1"
              onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)} onClick={() => setHover(m)}>
              <div className="w-1/2 rounded-t-md metal-gold transition-all duration-700" style={{ height: `${(gv / maxG) * 100}%`, minHeight: gv ? 3 : 0 }} />
              <div className="w-1/2 rounded-t-md metal-silver ring-1 ring-silver-300 transition-all duration-700" style={{ height: `${(sv / maxS) * 100}%`, minHeight: sv ? 3 : 0 }} />
              {hover === m && (
                <div className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-xl bg-maroon-950 px-3 py-2 text-xs text-white shadow-xl">
                  <div className="font-bold text-gold-200">{monthLabel(m)}</div>
                  <div>Gold: {grams(gv)}</div>
                  <div>Silver: {grams(sv)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 tablet:gap-2.5">
        {months.map((m) => <div key={m} className="flex-1 text-center text-[10px] text-charcoal/50">{monthLabel(m).split(' ')[0]}</div>)}
      </div>
    </div>
  );
}

function CategoryBars({ rows, lang }: { rows: Stats['byCategory']; lang: string }) {
  if (!rows.length) return <div className="py-10 text-center text-sm text-charcoal/50">Approved articles will appear here.</div>;
  const max = (m: Metal) => Math.max(1, ...rows.filter((r) => r.metal === m).map((r) => r.gross));
  return (
    <div className="mt-4 space-y-3 max-h-72 overflow-auto pr-1">
      {rows.map((r) => (
        <div key={`${r.metal}-${r.name}`}>
          <div className="flex justify-between text-sm">
            <span className="truncate font-medium">{lang === 'kn' && r.name_kn ? r.name_kn : r.name}</span>
            <span className="tabular font-semibold">{gramsShort(r.gross)} <span className="text-xs font-normal text-charcoal/50">· {int(r.pieces)} pc</span></span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-cream-100 overflow-hidden">
            <div className={`h-full rounded-full ${r.metal === 'gold' ? 'metal-gold' : 'metal-silver'} transition-all duration-700`} style={{ width: `${(r.gross / max(r.metal)) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
