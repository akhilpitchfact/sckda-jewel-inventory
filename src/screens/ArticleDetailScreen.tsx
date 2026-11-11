import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, photoUrl } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { ErrorBox, Field, Icon, Loading, Mandala, MetalBadge, Modal, SourceBadge, Spinner, StatusBadge } from '../components/ui';
import { dateTime, grams } from '../format';
import { ACTION_LABEL, auditSummary } from '../utils/audit';
import { articleRegisterPdf } from '../reports/exporters';
import type { Article, ArticleItem, AuditEntry, Photo } from '../types';

interface Detail { article: Article; items: ArticleItem[]; photos: Photo[]; history: AuditEntry[] }

export default function ArticleDetailScreen() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const justSaved = (loc.state as { justSaved?: boolean } | null)?.justSaved;

  const load = useCallback(() => api.get<Detail>(`/articles/${id}`).then(setD).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!d) return <Loading />;
  const a = d.article;
  const gold = a.metal === 'gold';
  const canEdit = can('article.edit') && ['pending', 'returned'].includes(a.status);
  const canAmend = can('article.amend') && a.status === 'approved';
  const ownEntry = a.created_by === user?.id || a.updated_by === user?.id;
  const canVerify = can('article.verify') && a.status === 'pending';

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => nav(-1)} className="no-print inline-flex items-center gap-1 text-sm font-semibold text-maroon-700 hover:underline"><Icon name="back" className="w-4 h-4" />Back</button>

      {justSaved && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900 animate-rise">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-600 text-white"><Icon name="check" /></span>
          <div><b>Saved as {a.article_no}.</b> It is now waiting for a Verification Officer.</div>
          <Link to="/new" className="ml-auto btn-sm btn-ghost">Register another</Link>
        </div>
      )}

      {/* Hero */}
      <section className={`sheen relative overflow-hidden rounded-3xl p-6 tablet:p-8 shadow-glow animate-rise ${gold ? 'metal-gold text-maroon-950' : 'metal-silver text-charcoal'}`}>
        <Mandala className={`pointer-events-none absolute -right-20 -top-20 w-80 h-80 ${gold ? 'text-gold-800/20' : 'text-silver-700/20'}`} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.25em] opacity-60">{t('articleId', 'Article ID')}</div>
            <div className="font-mono text-3xl tablet:text-4xl font-bold tracking-tight">{a.article_no}</div>
            <div className="mt-2 flex flex-wrap gap-2"><StatusBadge status={a.status} /><SourceBadge source={a.source} /></div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-[.2em] opacity-60">{t('grossWeight', 'Gross weight')}</div>
            <div className="mt-1 text-4xl tablet:text-5xl font-bold tabular leading-none">{a.gross_weight.toFixed(3)}<span className="text-xl opacity-70"> g</span></div>
            <div className="text-sm opacity-70">{a.quantity} piece{a.quantity > 1 ? 's' : ''}{a.net_weight != null && ` · net ${grams(a.net_weight)}`}</div>
          </div>
        </div>
        <div className="relative mt-4 text-lg font-semibold">{lang === 'kn' && a.category_name_kn ? a.category_name_kn : a.category_name}{a.article_type && ` · ${a.article_type}`}</div>
        <div className="relative opacity-80">{a.description}</div>
      </section>

      {a.status === 'returned' && a.return_remarks && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="text-xs font-bold uppercase tracking-wider">Returned for correction</div>
          <div className="mt-1">{a.return_remarks}</div>
        </div>
      )}
      {a.status === 'cancelled' && (
        <div className="rounded-2xl border border-gray-300 bg-gray-50 p-4 text-gray-700"><b>Cancelled.</b> {a.cancel_reason}</div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {canEdit && <Link to={`/articles/${a.article_no}/edit`} className="btn-primary"><Icon name="edit" />{a.status === 'returned' ? 'Correct & resubmit' : 'Edit'}</Link>}
        {canAmend && <Link to={`/articles/${a.article_no}/edit`} className="btn-ghost"><Icon name="edit" />Amend (with reason)</Link>}
        <button type="button" className="btn-ghost" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); try { await articleRegisterPdf([d]); } finally { setPdfBusy(false); } }}>
          {pdfBusy ? <Spinner /> : <Icon name="download" />}Article register (PDF)
        </button>
        {can('article.cancel') && a.status !== 'cancelled' && <button type="button" className="btn-ghost text-red-700" onClick={() => setCancelOpen(true)}><Icon name="trash" />Cancel record</button>}
      </div>

      {canVerify && (ownEntry
        ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">You entered or edited this record, so a different officer must verify it.</div>
        : <VerifyPanel a={a} photoCount={d.photos.length} onDone={load} />)}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <section className="card p-5">
            <h2 className="section-title mb-3">{t('photos', 'Photographs')} <span className="text-sm font-normal text-charcoal/50">({d.photos.length})</span></h2>
            {d.photos.length === 0 ? <div className="rounded-xl bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">No photograph attached yet.</div> : (
              <div className="grid grid-cols-2 tablet:grid-cols-3 gap-3">
                {d.photos.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setLightbox(i)} className={`group relative aspect-square overflow-hidden rounded-2xl ring-2 ${gold ? 'ring-gold-300' : 'ring-silver-300'}`}>
                    <img src={photoUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title mb-3">Details</h2>
            <dl className="grid gap-x-6 gap-y-3 tablet:grid-cols-2 text-sm">
              <DL k={t('metal', 'Metal')}><MetalBadge metal={a.metal} /></DL>
              <DL k={t('receivedAt', 'Received')}>{dateTime(a.received_at)}</DL>
              <DL k={t('source', 'Source')}>{a.source === 'hundi' ? 'Hundi' : 'Seva'}</DL>
              <DL k={t('receiptRef', 'Receipt reference')}>{a.receipt_ref || '—'}</DL>
              <DL k={t('purity', 'Purity')}>{a.purity || 'Not assessed'}{a.purity_remarks && <div className="text-xs text-charcoal/60">{a.purity_remarks}</div>}</DL>
              <DL k={t('weighedBy', 'Weighed by')}>{a.weighed_by || '—'}</DL>
              <DL k={t('donorName', 'Donor')}>{a.donor_hidden ? <span className="inline-flex items-center gap-1 text-charcoal/50"><Icon name="lock" className="w-4 h-4" />Restricted</span> : a.donor_name || (a.source === 'hundi' ? 'Anonymous (Hundi)' : '—')}</DL>
              {!a.donor_hidden && <DL k={t('donorMobile', 'Donor mobile')}>{a.donor_mobile || '—'}</DL>}
              {!a.donor_hidden && a.donor_address && <DL k={t('donorAddress', 'Donor address')} wide>{a.donor_address}</DL>}
              {a.remarks && <DL k={t('remarks', 'Remarks')} wide>{a.remarks}</DL>}
              <DL k="Registered by">{a.created_by_name}<div className="text-xs text-charcoal/50">{dateTime(a.created_at)}</div></DL>
              <DL k="Verified by">{a.verified_by_name ? <>{a.verified_by_name}<div className="text-xs text-charcoal/50">{dateTime(a.verified_at)}</div></> : '—'}</DL>
              {a.verification_remarks && <DL k="Verification remarks" wide>{a.verification_remarks}</DL>}
            </dl>
          </section>

          {d.items.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="section-title p-5 pb-3">{t('individualWeights', 'Individual weights')}</h2>
              <table className="table-x">
                <thead><tr><th>#</th><th>Piece</th><th className="text-right">Weight (g)</th></tr></thead>
                <tbody>
                  {d.items.map((i) => <tr key={i.id}><td>{i.line_no}</td><td>{i.description || '—'}</td><td className="text-right tabular">{i.weight.toFixed(3)}</td></tr>)}
                  <tr className="font-bold"><td></td><td>Total</td><td className="text-right tabular">{d.items.reduce((s, i) => s + i.weight, 0).toFixed(3)}</td></tr>
                </tbody>
              </table>
            </section>
          )}
        </div>

        <section className="card p-5 lg:col-span-2 h-fit">
          <h2 className="section-title mb-4">{t('history', 'History')}</h2>
          <ol className="relative border-l-2 border-gold-300 ml-2 space-y-5">
            {d.history.map((h) => (
              <li key={h.id} className="ml-5">
                <span className={`absolute -left-[9px] mt-1 w-4 h-4 rounded-full ring-4 ring-white ${h.action === 'article.approved' ? 'bg-emerald-500' : h.action === 'article.returned' ? 'bg-red-500' : h.action === 'article.amended' || h.action === 'article.cancelled' ? 'bg-amber-500' : 'metal-gold'}`} />
                <div className="font-semibold text-sm">{ACTION_LABEL[h.action] || h.action}</div>
                <div className="text-xs text-charcoal/60">{h.user_name || 'System'} · {dateTime(h.at)}</div>
                {auditSummary(h.details) && h.action !== 'article.registered' && <div className="mt-1 text-xs text-charcoal/80 break-words">{auditSummary(h.details)}</div>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {lightbox !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <img src={photoUrl(d.photos[lightbox].id)} alt="" className="max-h-[85dvh] max-w-full rounded-xl" />
          <div className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/70">{a.article_no} · photo {lightbox + 1} of {d.photos.length} · {d.photos[lightbox].uploaded_by_name}, {dateTime(d.photos[lightbox].uploaded_at)}</div>
          {d.photos.length > 1 && <>
            <button type="button" className="absolute left-3 top-1/2 rounded-full bg-white/10 p-3 text-white" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + d.photos.length) % d.photos.length); }}><Icon name="back" /></button>
            <button type="button" className="absolute right-3 top-1/2 rotate-180 rounded-full bg-white/10 p-3 text-white" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % d.photos.length); }}><Icon name="back" /></button>
          </>}
        </div>
      )}

      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} a={a} onDone={() => { setCancelOpen(false); load(); }} />
    </div>
  );
}

function DL({ k, children, wide }: { k: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'tablet:col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-charcoal/50">{k}</dt>
      <dd className="mt-0.5 text-charcoal">{children}</dd>
    </div>
  );
}

const CHECKS = [
  ['description', 'Article description matches'],
  ['photo', 'Photograph matches the article'],
  ['quantity', 'Quantity counted'],
  ['weight', 'Weight re-checked on the scale'],
  ['source', 'Source of receipt is correct'],
  ['donor', 'Donor information checked (if any)'],
] as const;

function VerifyPanel({ a, photoCount, onDone }: { a: Article; photoCount: number; onDone: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState('');
  const [purity, setPurity] = useState(a.purity || '');
  const [purityRemarks, setPurityRemarks] = useState(a.purity_remarks || '');
  const [busy, setBusy] = useState<'' | 'approve' | 'return'>('');
  const [err, setErr] = useState('');
  const allChecked = CHECKS.every(([k]) => checks[k]);

  const act = async (decision: 'approve' | 'return') => {
    setErr('');
    if (decision === 'return' && !remarks.trim()) return setErr('Write what needs to be corrected in the remarks box.');
    setBusy(decision);
    try {
      await api.post(`/articles/${a.id}/verify`, { decision, remarks, checklist: checks, purity, purity_remarks: purityRemarks });
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  };

  return (
    <section className="no-print relative overflow-hidden rounded-3xl border-2 border-gold-400 bg-gradient-to-br from-gold-100/60 to-white p-5 tablet:p-6 shadow-glow animate-rise">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl metal-gold"><Icon name="check" /></span>
        <div>
          <h2 className="text-lg font-bold text-maroon-900">Verification <span className="text-sm font-medium text-gold-700">· ಪರಿಶೀಲನೆ</span></h2>
          <div className="text-xs text-charcoal/60">Check the physical article against this record, then approve or return it.</div>
        </div>
      </div>
      {photoCount === 0 && <div className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">No photograph is attached. Consider returning it for a photo.</div>}
      <div className="mt-4 grid gap-2 tablet:grid-cols-2">
        {CHECKS.map(([k, label]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition ${checks[k] ? 'bg-emerald-50 ring-emerald-300' : 'bg-white ring-cream-300'}`}>
            <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={!!checks[k]} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />
            <span className="text-sm font-medium">{label}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-3 tablet:grid-cols-2">
        <Field label="Purity (if assessed now)"><input className="input" value={purity} onChange={(e) => setPurity(e.target.value)} /></Field>
        <Field label="Assessment remarks"><input className="input" value={purityRemarks} onChange={(e) => setPurityRemarks(e.target.value)} /></Field>
        <Field label="Remarks (required when returning)" className="tablet:col-span-2"><textarea className="input min-h-[70px]" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
      </div>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn bg-emerald-700 text-white hover:bg-emerald-800 shadow-md" disabled={!allChecked || !!busy} onClick={() => act('approve')} title={allChecked ? '' : 'Tick every check first'}>
          {busy === 'approve' ? <Spinner /> : <Icon name="check" />}Approve
        </button>
        <button type="button" className="btn-ghost text-red-700" disabled={!!busy} onClick={() => act('return')}>
          {busy === 'return' ? <Spinner /> : <Icon name="back" />}Return for correction
        </button>
        {!allChecked && <span className="self-center text-xs text-charcoal/50">Tick every check to approve.</span>}
      </div>
    </section>
  );
}

function CancelModal({ open, onClose, a, onDone }: { open: boolean; onClose: () => void; a: Article; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`Cancel ${a.article_no}?`}>
      <p className="text-sm text-charcoal/70">The record is not deleted. It is marked as cancelled, kept in the audit trail, and left out of totals.</p>
      <Field label="Reason" required className="mt-4"><textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>Keep</button>
        <button type="button" className="btn-danger" disabled={busy} onClick={async () => {
          setBusy(true); setErr('');
          try { await api.post(`/articles/${a.id}/cancel`, { reason }); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        }}>{busy && <Spinner />}Cancel record</button>
      </div>
    </Modal>
  );
}
