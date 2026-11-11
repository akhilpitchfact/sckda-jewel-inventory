// The 12 reports from the proposal (§3.8). Each builds a ReportDoc from articles / audit rows.
import { api, qs } from '../api';
import { dateOnly, dateTime, istDay, istDayEnd, istDayStart, monthLabel } from '../format';
import { ACTION_LABEL, auditSummary } from '../utils/audit';
import type { Article, AuditEntry, Metal } from '../types';
import type { Column, ReportDoc, Section } from './exporters';

export type ParamKind = 'day' | 'range' | 'consolidated' | 'none';
export interface Params { day: string; from: string; to: string; mode: 'monthly' | 'annual'; year: string; month: string; scope: 'approved' | 'all'; metal: '' | Metal; articleNo: string }

export interface ReportDef {
  id: string; n: number; title: string; kn: string; desc: string; params: ParamKind;
  metal?: Metal; scope?: boolean; metalChoice?: boolean; photos?: boolean; articleNoFilter?: boolean;
  build: (p: Params) => Promise<ReportDoc>;
}

const COLS_REGISTER: Column[] = [
  { key: 'article_no', label: 'Article ID' }, { key: 'time', label: 'Received' }, { key: 'category', label: 'Category' },
  { key: 'type', label: 'Type' }, { key: 'description', label: 'Description' }, { key: 'source', label: 'Source' },
  { key: 'ref', label: 'Receipt ref.' }, { key: 'donor', label: 'Donor' }, { key: 'quantity', label: 'Qty', num: 0 },
  { key: 'gross', label: 'Gross (g)', num: 3 }, { key: 'net', label: 'Net (g)', num: 3 }, { key: 'purity', label: 'Purity' }, { key: 'status', label: 'Status' },
];

const STATUS = { pending: 'Pending', returned: 'Returned', approved: 'Approved', cancelled: 'Cancelled' };

const row = (a: Article) => ({
  article_no: a.article_no, time: dateTime(a.received_at), category: a.category_name, type: a.article_type, description: a.description,
  source: a.source === 'hundi' ? 'Hundi' : 'Seva', ref: a.receipt_ref, donor: a.donor_hidden ? 'Restricted' : a.donor_name,
  quantity: a.quantity, gross: a.gross_weight, net: a.net_weight, purity: a.purity, status: STATUS[a.status],
});

const tot = (rows: Article[], extra: Record<string, unknown> = {}) => ({
  article_no: `Total (${rows.length})`, quantity: rows.reduce((s, a) => s + a.quantity, 0),
  gross: rows.reduce((s, a) => s + a.gross_weight, 0), net: rows.reduce((s, a) => s + (a.net_weight ?? a.gross_weight), 0), ...extra,
});

async function fetchArticles(q: Record<string, string | undefined>) {
  return api.get<Article[]>(`/articles${qs({ ...q, limit: 20000 })}`);
}

const rangeLabel = (p: Params) => `${dateOnly(istDayStart(p.from))} to ${dateOnly(istDayStart(p.to))}`;
const rangeQ = (p: Params) => ({ from: istDayStart(p.from), to: istDayEnd(p.to) });
const scopeQ = (p: Params) => (p.scope === 'approved' ? { status: 'approved' } : {});
const scopeLabel = (p: Params) => (p.scope === 'approved' ? 'Approved (verified) articles only' : 'All recorded articles (approved + pending)');
const metalName = (m: Metal) => (m === 'gold' ? 'Gold' : 'Silver');

function daily(metal: Metal, n: number): ReportDef {
  return {
    id: `daily-${metal}`, n, title: `Daily ${metalName(metal)} Articles Receipt Register`, kn: metal === 'gold' ? 'ದೈನಂದಿನ ಚಿನ್ನದ ವಸ್ತುಗಳ ಸ್ವೀಕೃತಿ ವಹಿ' : 'ದೈನಂದಿನ ಬೆಳ್ಳಿ ವಸ್ತುಗಳ ಸ್ವೀಕೃತಿ ವಹಿ',
    desc: `Every ${metal} article received on one day, in order of receipt.`, params: 'day', metal,
    build: async (p) => {
      const rows = (await fetchArticles({ metal, from: istDayStart(p.day), to: istDayEnd(p.day) })).reverse();
      return {
        title: `Daily ${metalName(metal)} Articles Receipt Register`, period: dateOnly(istDayStart(p.day)), fileName: `daily-${metal}-register-${p.day}`,
        summary: [['Articles received', String(rows.length)], ['Pieces', String(tot(rows).quantity)], ['Gross weight', `${tot(rows).gross.toFixed(3)} g`],
          ['Approved / pending', `${rows.filter((a) => a.status === 'approved').length} / ${rows.filter((a) => a.status !== 'approved').length}`]],
        sections: [{ columns: COLS_REGISTER, rows: rows.map(row), totals: tot(rows) }],
      };
    },
  };
}

function grouped(source: 'hundi' | 'seva', metal: Metal, n: number): ReportDef {
  const S = source === 'hundi' ? 'Hundi' : 'Seva';
  return {
    id: `${source}-${metal}`, n, title: source === 'hundi' ? `Hundi-wise ${metalName(metal)} Inventory Statement` : `Seva-wise ${metalName(metal)} Articles Statement`,
    kn: `${source === 'hundi' ? 'ಹುಂಡಿವಾರು' : 'ಸೇವಾವಾರು'} ${metal === 'gold' ? 'ಚಿನ್ನ' : 'ಬೆಳ್ಳಿ'} ವಿವರಪಟ್ಟಿ`,
    desc: `${metalName(metal)} articles received through ${S}, grouped by ${source === 'hundi' ? 'Hundi batch' : 'Seva receipt'}.`,
    params: 'range', metal, scope: true,
    build: async (p) => {
      const rows = (await fetchArticles({ metal, source, ...rangeQ(p), ...scopeQ(p) })).reverse();
      const groups = new Map<string, Article[]>();
      for (const a of rows) { const k = a.receipt_ref || `(no ${source === 'hundi' ? 'batch' : 'receipt'} reference)`; groups.set(k, [...(groups.get(k) || []), a]); }
      const summary: Section = {
        heading: 'Summary', columns: [{ key: 'ref', label: source === 'hundi' ? 'Hundi batch' : 'Seva receipt' }, { key: 'first', label: 'Received' },
          { key: 'entries', label: 'Records', num: 0 }, { key: 'quantity', label: 'Pieces', num: 0 }, { key: 'gross', label: 'Gross (g)', num: 3 }, { key: 'net', label: 'Net (g)', num: 3 }],
        rows: [...groups].map(([k, g]) => ({ ref: k, first: dateOnly(g[0].received_at), entries: g.length, ...tot(g), article_no: undefined })),
        totals: { ref: 'Total', entries: rows.length, ...tot(rows), article_no: undefined },
      };
      return {
        title: (source === 'hundi' ? `Hundi-wise ${metalName(metal)} Inventory Statement` : `Seva-wise ${metalName(metal)} Articles Statement`),
        period: rangeLabel(p), fileName: `${source}-wise-${metal}-${p.from}-to-${p.to}`,
        summary: [['Scope', scopeLabel(p)], ['Records', String(rows.length)], ['Gross weight', `${tot(rows).gross.toFixed(3)} g`]],
        sections: [summary, ...[...groups].map(([k, g]) => ({ heading: `${S}: ${k}`, columns: COLS_REGISTER.filter((c) => c.key !== 'source' && c.key !== 'ref'), rows: g.map(row), totals: tot(g) }))],
      };
    },
  };
}

export const REPORTS: ReportDef[] = [
  daily('gold', 1),
  daily('silver', 2),
  grouped('hundi', 'gold', 3),
  grouped('hundi', 'silver', 4),
  grouped('seva', 'gold', 5),
  grouped('seva', 'silver', 6),
  {
    id: 'donor', n: 7, title: 'Donor-wise Article Statement', kn: 'ದಾನಿವಾರು ವಸ್ತುಗಳ ವಿವರಪಟ್ಟಿ', desc: 'Articles grouped by identified donor (anonymous entries are left out).',
    params: 'range', scope: true,
    build: async (p) => {
      const rows = (await fetchArticles({ ...rangeQ(p), ...scopeQ(p) })).filter((a) => a.donor_name && !a.donor_hidden).reverse();
      const groups = new Map<string, Article[]>();
      for (const a of rows) { const k = `${a.donor_name!.trim()}${a.donor_mobile ? ` (${a.donor_mobile})` : ''}`; groups.set(k, [...(groups.get(k) || []), a]); }
      const m = (g: Article[], metal: Metal) => g.filter((a) => a.metal === metal);
      return {
        title: 'Donor-wise Article Statement', period: rangeLabel(p), fileName: `donor-wise-${p.from}-to-${p.to}`,
        summary: [['Scope', scopeLabel(p)], ['Identified donors', String(groups.size)], ['Records', String(rows.length)]],
        sections: [{
          heading: 'Summary by donor',
          columns: [{ key: 'donor', label: 'Donor' }, { key: 'entries', label: 'Records', num: 0 }, { key: 'gp', label: 'Gold pcs', num: 0 }, { key: 'gg', label: 'Gold (g)', num: 3 },
            { key: 'sp', label: 'Silver pcs', num: 0 }, { key: 'sg', label: 'Silver (g)', num: 3 }],
          rows: [...groups].map(([k, g]) => ({ donor: k, entries: g.length, gp: tot(m(g, 'gold')).quantity, gg: tot(m(g, 'gold')).gross, sp: tot(m(g, 'silver')).quantity, sg: tot(m(g, 'silver')).gross })),
          totals: { donor: 'Total', entries: rows.length, gp: tot(m(rows, 'gold')).quantity, gg: tot(m(rows, 'gold')).gross, sp: tot(m(rows, 'silver')).quantity, sg: tot(m(rows, 'silver')).gross },
        }, ...[...groups].map(([k, g]) => ({ heading: k, columns: [{ key: 'metal', label: 'Metal' }, ...COLS_REGISTER.filter((c) => c.key !== 'donor')], rows: g.map((a) => ({ ...row(a), metal: metalName(a.metal) })), totals: tot(g) }))],
      };
    },
  },
  {
    id: 'category', n: 8, title: 'Category-wise Inventory Report', kn: 'ವರ್ಗವಾರು ದಾಸ್ತಾನು ವರದಿ', desc: 'Records, pieces and weight for each gold and silver category.',
    params: 'range', scope: true,
    build: async (p) => {
      const rows = await fetchArticles({ ...rangeQ(p), ...scopeQ(p) });
      const sec = (metal: Metal): Section => {
        const g = new Map<string, Article[]>();
        rows.filter((a) => a.metal === metal).forEach((a) => g.set(a.category_name, [...(g.get(a.category_name) || []), a]));
        const all = rows.filter((a) => a.metal === metal);
        return {
          heading: `${metalName(metal)} inventory`,
          columns: [{ key: 'cat', label: 'Category' }, { key: 'entries', label: 'Records', num: 0 }, { key: 'hundi', label: 'Hundi (g)', num: 3 }, { key: 'seva', label: 'Seva (g)', num: 3 },
            { key: 'quantity', label: 'Pieces', num: 0 }, { key: 'gross', label: 'Gross (g)', num: 3 }, { key: 'net', label: 'Net (g)', num: 3 }],
          rows: [...g].sort((x, y) => tot(y[1]).gross - tot(x[1]).gross).map(([k, list]) => ({
            cat: k, entries: list.length, hundi: tot(list.filter((a) => a.source === 'hundi')).gross, seva: tot(list.filter((a) => a.source === 'seva')).gross, ...tot(list), article_no: undefined,
          })),
          totals: { cat: 'Total', entries: all.length, hundi: tot(all.filter((a) => a.source === 'hundi')).gross, seva: tot(all.filter((a) => a.source === 'seva')).gross, ...tot(all), article_no: undefined },
        };
      };
      return { title: 'Category-wise Inventory Report', period: rangeLabel(p), fileName: `category-wise-${p.from}-to-${p.to}`, landscape: false,
        summary: [['Scope', scopeLabel(p)]], sections: [sec('gold'), sec('silver')] };
    },
  },
  {
    id: 'register-photos', n: 9, title: 'Individual Article Register with Photographs', kn: 'ಛಾಯಾಚಿತ್ರ ಸಹಿತ ವಸ್ತು ವಹಿ', desc: 'One page per article with all details and photographs (PDF).',
    params: 'range', scope: true, metalChoice: true, photos: true,
    build: async (p) => {
      const rows = (await fetchArticles({ ...rangeQ(p), ...scopeQ(p), metal: p.metal || undefined })).reverse();
      return { title: 'Individual Article Register', period: rangeLabel(p), fileName: `article-register-${p.from}-to-${p.to}`, summary: [['Scope', scopeLabel(p)], ['Articles', String(rows.length)]],
        sections: [{ columns: [{ key: 'metal', label: 'Metal' }, ...COLS_REGISTER, { key: 'photos', label: 'Photos', num: 0 }], rows: rows.map((a) => ({ ...row(a), metal: metalName(a.metal), photos: a.photo_count, _a: a })), totals: tot(rows) }] };
    },
  },
  {
    id: 'consolidated', n: 10, title: 'Monthly & Annual Gold and Silver Consolidated Statement', kn: 'ಮಾಸಿಕ ಮತ್ತು ವಾರ್ಷಿಕ ಕ್ರೋಢೀಕೃತ ವಿವರಪಟ್ಟಿ', desc: 'Day-by-day for a month, or month-by-month for a year, gold and silver side by side.',
    params: 'consolidated', scope: true,
    build: async (p) => {
      const annual = p.mode === 'annual';
      const from = annual ? `${p.year}-01-01` : `${p.month}-01`;
      const endDate = annual ? new Date(Date.UTC(Number(p.year) + 1, 0, 1)) : new Date(Date.UTC(Number(p.month.slice(0, 4)), Number(p.month.slice(5, 7)), 1));
      const to = new Date(endDate.getTime() - 86400_000).toISOString().slice(0, 10);
      const rows = await fetchArticles({ from: istDayStart(from), to: istDayEnd(to), ...scopeQ(p) });
      const keyOf = (a: Article) => (annual ? istDay(a.received_at).slice(0, 7) : istDay(a.received_at));
      const keys: string[] = [];
      if (annual) for (let m = 1; m <= 12; m++) keys.push(`${p.year}-${String(m).padStart(2, '0')}`);
      else for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400_000)) keys.push(d.toISOString().slice(0, 10));
      const agg = (list: Article[]) => {
        const g = list.filter((a) => a.metal === 'gold'); const s = list.filter((a) => a.metal === 'silver');
        return {
          gh: tot(g.filter((a) => a.source === 'hundi')).gross, gs: tot(g.filter((a) => a.source === 'seva')).gross, gp: tot(g).quantity, gt: tot(g).gross,
          sh: tot(s.filter((a) => a.source === 'hundi')).gross, ss: tot(s.filter((a) => a.source === 'seva')).gross, sp: tot(s).quantity, st: tot(s).gross,
        };
      };
      return {
        title: annual ? `Annual Gold & Silver Consolidated Statement ${p.year}` : `Monthly Gold & Silver Consolidated Statement`,
        period: annual ? `1 Jan ${p.year} to 31 Dec ${p.year}` : monthLabel(p.month).replace(' ', ' 20'),
        fileName: annual ? `consolidated-${p.year}` : `consolidated-${p.month}`,
        summary: [['Scope', scopeLabel(p)]],
        sections: [{
          columns: [{ key: 'period', label: annual ? 'Month' : 'Date' }, { key: 'gh', label: 'Gold Hundi (g)', num: 3 }, { key: 'gs', label: 'Gold Seva (g)', num: 3 },
            { key: 'gp', label: 'Gold pcs', num: 0 }, { key: 'gt', label: 'Gold total (g)', num: 3 }, { key: 'sh', label: 'Silver Hundi (g)', num: 3 },
            { key: 'ss', label: 'Silver Seva (g)', num: 3 }, { key: 'sp', label: 'Silver pcs', num: 0 }, { key: 'st', label: 'Silver total (g)', num: 3 }],
          rows: keys.map((k) => ({ period: annual ? monthLabel(k) : dateOnly(istDayStart(k)), ...agg(rows.filter((a) => keyOf(a) === k)) })),
          totals: { period: 'Total', ...agg(rows) },
        }],
      };
    },
  },
  {
    id: 'pending', n: 11, title: 'Pending Verification Report', kn: 'ಪರಿಶೀಲನೆ ಬಾಕಿ ವರದಿ', desc: 'Every record still waiting for verification or correction, with days waiting.',
    params: 'none',
    build: async () => {
      const rows = (await fetchArticles({ status: 'pending,returned' })).reverse();
      const days = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86400_000);
      return {
        title: 'Pending Verification Report', period: `As on ${dateTime(new Date().toISOString())}`, fileName: `pending-verification-${istDay()}`,
        summary: [['Pending verification', String(rows.filter((a) => a.status === 'pending').length)], ['Returned for correction', String(rows.filter((a) => a.status === 'returned').length)]],
        sections: [{
          columns: [{ key: 'article_no', label: 'Article ID' }, { key: 'metal', label: 'Metal' }, { key: 'time', label: 'Received' }, { key: 'description', label: 'Description' },
            { key: 'quantity', label: 'Qty', num: 0 }, { key: 'gross', label: 'Gross (g)', num: 3 }, { key: 'by', label: 'Entered by' }, { key: 'status', label: 'Status' },
            { key: 'note', label: 'Correction asked' }, { key: 'days', label: 'Days waiting', num: 0 }],
          rows: rows.map((a) => ({ ...row(a), metal: metalName(a.metal), by: a.created_by_name, note: a.return_remarks, days: days(a.updated_at || a.created_at) })),
          totals: tot(rows),
        }],
      };
    },
  },
  {
    id: 'audit', n: 12, title: 'Complete Article Movement and Audit History', kn: 'ವಸ್ತು ಚಲನೆ ಮತ್ತು ಲೆಕ್ಕಪರಿಶೋಧನಾ ಇತಿಹಾಸ', desc: 'Every action on every article: who did what and when, with old and new values.',
    params: 'range', articleNoFilter: true,
    build: async (p) => {
      const rows = (await api.get<AuditEntry[]>(`/audit${qs({ ...rangeQ(p), article_no: p.articleNo || undefined, limit: 20000 })}`))
        .filter((h) => h.article_no).reverse();
      return {
        title: 'Article Movement and Audit History', period: rangeLabel(p) + (p.articleNo ? ` · ${p.articleNo}` : ''), fileName: `audit-history-${p.from}-to-${p.to}`,
        summary: [['Actions recorded', String(rows.length)]],
        sections: [{
          columns: [{ key: 'at', label: 'Date & time' }, { key: 'article_no', label: 'Article ID' }, { key: 'action', label: 'Action' }, { key: 'user', label: 'Officer' },
            { key: 'role', label: 'Role' }, { key: 'details', label: 'Details' }],
          rows: rows.map((h) => ({ at: dateTime(h.at), article_no: h.article_no, action: ACTION_LABEL[h.action] || h.action, user: h.user_name, role: h.user_role, details: h.action === 'article.registered' ? '' : auditSummary(h.details) })),
        }],
      };
    },
  },
];

