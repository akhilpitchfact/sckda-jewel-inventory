import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { ErrorBox, Field, Icon, PageHeader, Spinner } from '../components/ui';
import { REPORTS, type Params, type ReportDef } from '../reports/definitions';
import { articleRegisterPdf, cell, exportExcel, exportPdf, loadDetails, type ReportDoc } from '../reports/exporters';
import { istDay } from '../format';
import type { Article } from '../types';

export default function ReportsScreen() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const today = istDay();
  const [sel, setSel] = useState<ReportDef | null>(null);
  const [p, setP] = useState<Params>({
    day: today, from: `${today.slice(0, 8)}01`, to: today, mode: 'monthly', year: today.slice(0, 4), month: today.slice(0, 7),
    scope: 'approved', metal: '', articleNo: '',
  });
  const [doc, setDoc] = useState<ReportDoc | null>(null);
  const [busy, setBusy] = useState<'' | 'view' | 'pdf' | 'xlsx' | 'photos'>('');
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');
  const set = <K extends keyof Params>(k: K, v: Params[K]) => { setP((x) => ({ ...x, [k]: v })); setDoc(null); };
  const by = `${user?.name}`;

  const run = async (what: 'view' | 'pdf' | 'xlsx' | 'photos') => {
    if (!sel) return;
    setErr(''); setBusy(what);
    try {
      const d = doc ?? await sel.build(p);
      setDoc(d);
      if (what === 'pdf') await exportPdf(d, by);
      if (what === 'xlsx') await exportExcel(d, by);
      if (what === 'photos') {
        const arts = d.sections[0].rows.map((r) => r._a as Article);
        if (!arts.length) throw new Error('No articles in this period');
        setProgress(`Loading ${arts.length} articles…`);
        const details = await loadDetails(arts);
        await articleRegisterPdf(details, by, d.period, (n, t) => setProgress(`Adding photos ${n} of ${t}…`));
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(''); setProgress(''); }
  };

  return (
    <div>
      <PageHeader title="Reports & statements" kn="ವರದಿಗಳು ಮತ್ತು ವಿವರಪಟ್ಟಿಗಳು" subtitle="Choose a report, set the period, then view it or download it as PDF or Excel." />

      <div className="grid gap-3 tablet:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <button key={r.id} type="button" onClick={() => { setSel(r); setDoc(null); setErr(''); setTimeout(() => document.getElementById('report-params')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
            className={`group relative overflow-hidden rounded-2xl p-4 text-left transition ring-1 ${sel?.id === r.id ? 'bg-maroon-900 text-white ring-gold-400 shadow-glow' : 'bg-white ring-cream-200 hover:ring-gold-300 hover:shadow-soft'}`}>
            <div className="flex items-start gap-3">
              <span className={`grid place-items-center w-9 h-9 shrink-0 rounded-xl text-sm font-bold ${r.metal === 'silver' ? 'metal-silver text-charcoal' : 'metal-gold text-maroon-950'}`}>{r.n}</span>
              <div className="min-w-0">
                <div className={`text-xs ${sel?.id === r.id ? 'text-gold-200' : 'text-gold-700'}`}>{r.kn}</div>
                <div className="font-bold leading-snug">{r.title}</div>
                <div className={`mt-1 text-xs ${sel?.id === r.id ? 'text-white/70' : 'text-charcoal/60'}`}>{r.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {sel && (
        <section id="report-params" className="card mt-6 p-5 tablet:p-6 animate-rise scroll-mt-24">
          <h2 className="section-title">{sel.n}. {sel.title}</h2>
          <div className="mt-4 grid gap-4 tablet:grid-cols-2 lg:grid-cols-4">
            {sel.params === 'day' && <Field label="Date"><input type="date" className="input" value={p.day} max={today} onChange={(e) => set('day', e.target.value)} /></Field>}
            {sel.params === 'range' && <>
              <Field label="From"><input type="date" className="input" value={p.from} max={p.to} onChange={(e) => set('from', e.target.value)} /></Field>
              <Field label="To"><input type="date" className="input" value={p.to} min={p.from} max={today} onChange={(e) => set('to', e.target.value)} /></Field>
            </>}
            {sel.params === 'consolidated' && <>
              <Field label="Statement">
                <select className="input" value={p.mode} onChange={(e) => set('mode', e.target.value as Params['mode'])}><option value="monthly">Monthly (day by day)</option><option value="annual">Annual (month by month)</option></select>
              </Field>
              {p.mode === 'monthly'
                ? <Field label="Month"><input type="month" className="input" value={p.month} max={today.slice(0, 7)} onChange={(e) => set('month', e.target.value)} /></Field>
                : <Field label="Year"><input type="number" className="input" value={p.year} min={2020} max={Number(today.slice(0, 4))} onChange={(e) => set('year', e.target.value)} /></Field>}
            </>}
            {sel.scope && (
              <Field label="Include">
                <select className="input" value={p.scope} onChange={(e) => set('scope', e.target.value as Params['scope'])}><option value="approved">Approved (verified) only</option><option value="all">All recorded, incl. pending</option></select>
              </Field>
            )}
            {sel.metalChoice && (
              <Field label="Metal"><select className="input" value={p.metal} onChange={(e) => set('metal', e.target.value as Params['metal'])}><option value="">Gold and silver</option><option value="gold">Gold</option><option value="silver">Silver</option></select></Field>
            )}
            {sel.articleNoFilter && <Field label="Article ID (optional)"><input className="input font-mono uppercase" placeholder="AU-2026-00001" value={p.articleNo} onChange={(e) => set('articleNo', e.target.value.toUpperCase().trim())} /></Field>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!!busy} onClick={() => run('view')}>{busy === 'view' ? <Spinner /> : <Icon name="report" />}View report</button>
            {sel.photos
              ? <button type="button" className="btn-gold" disabled={!!busy} onClick={() => run('photos')}>{busy === 'photos' ? <Spinner /> : <Icon name="download" />}PDF with photographs</button>
              : <button type="button" className="btn-gold" disabled={!!busy} onClick={() => run('pdf')}>{busy === 'pdf' ? <Spinner /> : <Icon name="download" />}Download PDF</button>}
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => run('xlsx')}>{busy === 'xlsx' ? <Spinner /> : <Icon name="download" />}Download Excel</button>
            {doc && <button type="button" className="btn-ghost" onClick={() => window.print()}><Icon name="print" />Print</button>}
          </div>
          {progress && <div className="mt-3 text-sm text-maroon-700">{progress}</div>}
          {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
          {lang === 'kn' && <div className="mt-3 text-xs text-charcoal/50">Tip: names typed in Kannada print best with the Print button (Save as PDF).</div>}
        </section>
      )}

      {doc && <ReportPreview doc={doc} />}
    </div>
  );
}

function ReportPreview({ doc }: { doc: ReportDoc }) {
  return (
    <section className="mt-6 card overflow-hidden animate-rise print:shadow-none print:border-0">
      <div className="temple-bg px-5 py-4 text-white print:bg-none print:text-black">
        <div className="text-xs text-gold-200/80 print:text-black">Sri Chamundeshwari Kshetra Development Authority, Mysuru</div>
        <div className="py-0.5 text-xl font-bold leading-normal gold-text print:text-black">{doc.title}</div>
        <div className="text-sm text-white/70 print:text-black">{doc.period}</div>
      </div>
      {doc.summary && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-cream-200 px-5 py-3 text-sm">
          {doc.summary.map(([k, v]) => <div key={k}><span className="text-charcoal/50">{k}: </span><b>{v}</b></div>)}
        </div>
      )}
      <div className="space-y-6 p-5">
        {doc.sections.map((s, i) => (
          <div key={i}>
            {s.heading && <h3 className="mb-2 font-bold text-maroon-800">{s.heading}</h3>}
            <div className="overflow-x-auto rounded-xl ring-1 ring-cream-200">
              <table className="table-x">
                <thead><tr>{s.columns.map((c) => <th key={c.key} className={c.num != null ? 'text-right' : ''}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {s.rows.length === 0 && <tr><td colSpan={s.columns.length} className="py-6 text-center text-charcoal/50">No records</td></tr>}
                  {s.rows.slice(0, 1000).map((r, j) => (
                    <tr key={j}>{s.columns.map((c) => <td key={c.key} className={c.num != null ? 'text-right tabular whitespace-nowrap' : c.key === 'description' || c.key === 'details' ? 'min-w-[200px]' : 'whitespace-nowrap'}>{cell(r[c.key], c)}</td>)}</tr>
                  ))}
                  {s.totals && <tr className="bg-gold-100 font-bold">{s.columns.map((c) => <td key={c.key} className={c.num != null ? 'text-right tabular' : ''}>{cell(s.totals![c.key], c)}</td>)}</tr>}
                </tbody>
              </table>
            </div>
            {s.rows.length > 1000 && <div className="mt-1 text-xs text-charcoal/50">Showing first 1,000 rows. Downloads include all {s.rows.length}.</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
