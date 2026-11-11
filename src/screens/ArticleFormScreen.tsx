import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, photoUrl } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { ErrorBox, Field, Icon, Loading, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { PhotoPicker, type LocalPhoto } from '../components/PhotoPicker';
import { compressImage } from '../utils/image';
import { fromLocalInput, grams, toLocalInput } from '../format';
import type { Article, ArticleItem, Category, Metal, Photo, Source } from '../types';

const TYPES = ['Chain', 'Ring', 'Coin', 'Necklace', 'Pendant', 'Bangle', 'Bracelet', 'Earring', 'Nose ring', 'Mangalasutra', 'Thali', 'Anklet', 'Waist belt', 'Crown', 'Eyes (Netra)', 'Lamp', 'Plate', 'Vessel', 'Bowl', 'Glass', 'Spoon', 'Idol', 'Biscuit / Bar', 'Mixed / Assorted'];
const GOLD_PURITY = ['24K (999)', '22K (916)', '20K (833)', '18K (750)', '14K (585)', 'Not assessed'];
const SILVER_PURITY = ['999 Fine', '925 Sterling', '900', '800', 'Not assessed'];

interface Form {
  source: Source; received_at: string; receipt_ref: string;
  donor_name: string; donor_mobile: string; donor_address: string;
  metal: Metal; category_id: string; article_type: string; description: string; quantity: string;
  gross_weight: string; net_weight: string; purity: string; purity_remarks: string; weighed_by: string; remarks: string;
}

export default function ArticleFormScreen() {
  const { id } = useParams();
  const isEdit = !!id;
  const { user, can } = useAuth();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [orig, setOrig] = useState<Article | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<number[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [items, setItems] = useState<{ description: string; weight: string }[]>([]);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [f, setF] = useState<Form>({
    source: 'hundi', received_at: toLocalInput(), receipt_ref: '',
    donor_name: '', donor_mobile: '', donor_address: '',
    metal: 'gold', category_id: '', article_type: '', description: '', quantity: '1',
    gross_weight: '', net_weight: '', purity: '', purity_remarks: '', weighed_by: user?.name || '', remarks: '',
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { api.get<Category[]>('/categories').then(setCats).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    if (!id) return;
    api.get<{ article: Article; items: ArticleItem[]; photos: Photo[] }>(`/articles/${id}`).then(({ article: a, items: its, photos: ph }) => {
      setOrig(a);
      setExistingPhotos(ph);
      setItems(its.map((i) => ({ description: i.description || '', weight: String(i.weight) })));
      setF({
        source: a.source, received_at: toLocalInput(a.received_at), receipt_ref: a.receipt_ref || '',
        donor_name: a.donor_name || '', donor_mobile: a.donor_mobile || '', donor_address: a.donor_address || '',
        metal: a.metal, category_id: String(a.category_id), article_type: a.article_type || '', description: a.description,
        quantity: String(a.quantity), gross_weight: String(a.gross_weight), net_weight: a.net_weight != null ? String(a.net_weight) : '',
        purity: a.purity || '', purity_remarks: a.purity_remarks || '', weighed_by: a.weighed_by || '', remarks: a.remarks || '',
      });
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [id]);

  const amend = orig?.status === 'approved';
  const metalCats = useMemo(() => cats.filter((c) => c.metal === f.metal && (c.active || String(c.id) === f.category_id)), [cats, f.metal, f.category_id]);
  const itemSum = items.reduce((s, i) => s + (Number(i.weight) || 0), 0);
  const itemMismatch = items.length > 0 && f.gross_weight && Math.abs(itemSum - Number(f.gross_weight)) > 0.0005;

  const addPhotos = async (files: File[]) => {
    for (const file of files) {
      const blob = await compressImage(file);
      setPhotos((p) => [...p, { key: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) }]);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!f.category_id) return setErr('Choose a category');
    if (amend && !reason.trim()) return setErr('Write the reason for amending an approved record');
    setBusy(true);
    try {
      const body = {
        ...f, received_at: fromLocalInput(f.received_at), category_id: Number(f.category_id), quantity: Number(f.quantity),
        items: items.filter((i) => Number(i.weight) > 0).map((i) => ({ description: i.description, weight: Number(i.weight) })),
        reason,
      };
      let target = orig?.article_no;
      if (!isEdit) {
        const r = await api.post<{ id: number; article_no: string }>('/articles', body);
        target = r.article_no;
      } else if (amend) {
        await api.post(`/articles/${orig!.id}/amend`, body).catch((e2) => {
          // Photo-only changes on an approved record are allowed without field changes
          if (!(e2.message === 'Nothing was changed' && (photos.length || removedPhotos.length))) throw e2;
        });
      } else {
        await api.put(`/articles/${orig!.id}`, body);
      }
      for (const pid of removedPhotos) await api.del(`/photos/${pid}`);
      if (photos.length) {
        const fd = new FormData();
        photos.forEach((p, i) => fd.append('photos', p.blob, `photo-${i + 1}.jpg`));
        await api.post(`/articles/${target}/photos`, fd);
      }
      nav(`/articles/${target}`, { replace: true, state: { justSaved: !isEdit } });
    } catch (e2) {
      setErr((e2 as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (isEdit && orig && !(['pending', 'returned'].includes(orig.status) ? can('article.edit') : orig.status === 'approved' && can('article.amend'))) {
    return <ErrorBox>This record cannot be edited.</ErrorBox>;
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-4xl">
      <PageHeader
        title={!isEdit ? 'Register article' : amend ? `Amend ${orig?.article_no}` : `Edit ${orig?.article_no}`}
        kn={!isEdit ? 'ಹೊಸ ವಸ್ತು ನೋಂದಣಿ' : 'ತಿದ್ದುಪಡಿ'}
        subtitle={!isEdit ? 'Article ID is generated automatically when you save. The entry then goes to a Verification Officer.' : orig && <StatusBadge status={orig.status} />}
      />
      {orig?.status === 'returned' && orig.return_remarks && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="text-xs font-bold uppercase tracking-wider">Returned for correction</div>
          <div className="mt-1">{orig.return_remarks}</div>
        </div>
      )}
      {amend && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 text-sm">
          <b>This record is approved.</b> Every change is saved in the audit trail with the old and new values and your reason.
        </div>
      )}
      <ErrorBox>{err}</ErrorBox>

      <Section n={1} title="Receipt" kn="ಸ್ವೀಕೃತಿ">
        <div className="grid grid-cols-2 gap-3">
          {(['hundi', 'seva'] as const).map((s) => (
            <button key={s} type="button" onClick={() => set('source', s)}
              className={`rounded-2xl border-2 px-4 py-4 text-left transition ${f.source === s ? 'border-maroon-700 bg-maroon-50 shadow-md' : 'border-cream-200 bg-white hover:border-cream-300'}`}>
              <div className="text-lg font-bold text-maroon-900">{s === 'hundi' ? t('hundi', 'Hundi') : t('seva', 'Seva')}</div>
              <div className="text-xs text-charcoal/60">{s === 'hundi' ? 'Hundi collection. Donor usually anonymous.' : 'Offered through a Seva. Donor details recorded.'}</div>
            </button>
          ))}
        </div>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label={t('receivedAt', 'Date & time of receipt')} required>
            <input type="datetime-local" className="input" value={f.received_at} max={toLocalInput()} onChange={(e) => set('received_at', e.target.value)} required />
          </Field>
          <Field label={f.source === 'hundi' ? 'Hundi batch reference' : 'Seva receipt / transaction no.'} hint={f.source === 'hundi' ? 'e.g. Hundi No. 7, counting of 11 Nov 2026' : undefined}>
            <input className="input" value={f.receipt_ref} onChange={(e) => set('receipt_ref', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section n={2} title="Donor" kn="ದಾನಿ" note={f.source === 'hundi' ? 'Optional. Anonymous Hundi articles need no donor details.' : 'Fill in whatever the donor has provided.'}>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label={t('donorName', 'Donor name')}><input className="input" value={f.donor_name} onChange={(e) => set('donor_name', e.target.value)} /></Field>
          <Field label={t('donorMobile', 'Donor mobile')} hint="Only if voluntarily provided"><input className="input" inputMode="tel" value={f.donor_mobile} onChange={(e) => set('donor_mobile', e.target.value)} /></Field>
          <Field label={t('donorAddress', 'Donor address')} className="tablet:col-span-2"><textarea className="input min-h-[80px]" value={f.donor_address} onChange={(e) => set('donor_address', e.target.value)} /></Field>
        </div>
      </Section>

      <Section n={3} title="Article" kn="ವಸ್ತು">
        <div className="grid grid-cols-2 gap-3">
          {(['gold', 'silver'] as const).map((m) => (
            <button key={m} type="button" disabled={isEdit} onClick={() => { set('metal', m); set('category_id', ''); set('purity', ''); }}
              className={`sheen relative overflow-hidden rounded-2xl px-4 py-5 text-left transition ${m === 'gold' ? 'metal-gold' : 'metal-silver'} ${f.metal === m ? 'ring-4 ring-maroon-700 shadow-glow scale-[1.01]' : 'opacity-60 hover:opacity-90'} disabled:cursor-not-allowed`}>
              <div className={`text-2xl font-bold ${m === 'gold' ? 'text-maroon-950' : 'text-charcoal'}`}>{m === 'gold' ? t('gold', 'Gold') : t('silver', 'Silver')}</div>
              <div className="text-xs opacity-70">{m === 'gold' ? 'ಚಿನ್ನ · Article ID AU-…' : 'ಬೆಳ್ಳಿ · Article ID AG-…'}</div>
              {f.metal === m && <span className="absolute right-3 top-3 grid place-items-center w-7 h-7 rounded-full bg-maroon-800 text-white"><Icon name="check" className="w-4 h-4" /></span>}
            </button>
          ))}
        </div>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label={t('category', 'Category')} required>
            <select className="input" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} required>
              <option value="">Choose…</option>
              {metalCats.map((c) => <option key={c.id} value={c.id}>{lang === 'kn' && c.name_kn ? `${c.name_kn} · ${c.name}` : c.name}</option>)}
            </select>
          </Field>
          <Field label={t('articleType', 'Article type')} hint="Pick from the list or type your own">
            <input className="input" list="article-types" value={f.article_type} onChange={(e) => set('article_type', e.target.value)} />
            <datalist id="article-types">{TYPES.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field label={t('description', 'Description')} required className="tablet:col-span-2" hint="Design, marks, stones, damage: anything that identifies the article">
            <textarea className="input min-h-[90px]" value={f.description} onChange={(e) => set('description', e.target.value)} required />
          </Field>
          <Field label={t('quantity', 'Quantity (number of pieces)')} required>
            <input type="number" min={1} step={1} className="input tabular" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} required />
          </Field>
        </div>
      </Section>

      <Section n={4} title="Weight & purity" kn="ತೂಕ ಮತ್ತು ಶುದ್ಧತೆ" note="Weights in grams, up to 3 decimals (milligram).">
        <div className="grid gap-4 tablet:grid-cols-3">
          <Field label={t('grossWeight', 'Gross weight (g)')} required>
            <input type="number" min={0.001} step={0.001} inputMode="decimal" className="input text-xl font-bold tabular" value={f.gross_weight} onChange={(e) => set('gross_weight', e.target.value)} required />
          </Field>
          <Field label={t('netWeight', 'Net weight (g)')} hint="Excluding stones, lac, threads">
            <input type="number" min={0.001} step={0.001} inputMode="decimal" className="input tabular" value={f.net_weight} onChange={(e) => set('net_weight', e.target.value)} />
          </Field>
          <Field label={t('purity', 'Purity')} hint="If assessed">
            <input className="input" list="purity-list" value={f.purity} onChange={(e) => set('purity', e.target.value)} />
            <datalist id="purity-list">{(f.metal === 'gold' ? GOLD_PURITY : SILVER_PURITY).map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field label="Purity / assessment remarks" className="tablet:col-span-2"><input className="input" value={f.purity_remarks} onChange={(e) => set('purity_remarks', e.target.value)} /></Field>
          <Field label={t('weighedBy', 'Weighed by (officer)')} required><input className="input" value={f.weighed_by} onChange={(e) => set('weighed_by', e.target.value)} required /></Field>
        </div>

        <div className="rounded-2xl bg-cream-100/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{t('individualWeights', 'Individual article weights')}</div>
              <div className="text-xs text-charcoal/60">Optional. When several pieces are received together, weigh each one.</div>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setItems((x) => [...x, { description: '', weight: '' }])}><Icon name="plus" className="w-4 h-4" />Add piece</button>
          </div>
          {items.length > 0 && (
            <div className="mt-3 space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="w-7 text-right text-sm font-semibold text-charcoal/50">{i + 1}.</span>
                  <input className="input flex-1 !min-h-[42px] !py-2" placeholder="Piece description" value={it.description}
                    onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                  <input className="input w-32 !min-h-[42px] !py-2 tabular" type="number" min={0.001} step={0.001} placeholder="grams" value={it.weight}
                    onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, weight: e.target.value } : y)))} />
                  <button type="button" className="rounded-lg p-2 text-charcoal/50 hover:bg-white" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-1 text-sm">
                <span>Total of pieces: <b className="tabular">{grams(itemSum)}</b></span>
                {itemMismatch && (
                  <button type="button" className="btn-sm btn-gold" onClick={() => set('gross_weight', itemSum.toFixed(3))}>Use as gross weight</button>
                )}
              </div>
              {itemMismatch && <div className="text-xs text-amber-700 text-right">Pieces add up to {grams(itemSum)}, gross weight is {grams(Number(f.gross_weight))}.</div>}
            </div>
          )}
        </div>
      </Section>

      <Section n={5} title="Photographs" kn="ಛಾಯಾಚಿತ್ರಗಳು" note="Photograph every article. Several photos can be attached.">
        {existingPhotos.filter((p) => !removedPhotos.includes(p.id)).length > 0 && (
          <div className="grid grid-cols-3 tablet:grid-cols-4 gap-3">
            {existingPhotos.filter((p) => !removedPhotos.includes(p.id)).map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-cream-300">
                <img src={photoUrl(p.id)} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setRemovedPhotos((x) => [...x, p.id])} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white" aria-label="Remove photo">
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <PhotoPicker photos={photos} onAdd={addPhotos} onRemove={(k) => setPhotos((x) => x.filter((p) => p.key !== k))} />
      </Section>

      <Section n={6} title="Remarks" kn="ಷರಾ">
        <textarea className="input min-h-[80px]" value={f.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Anything else the verifier should know" />
        {amend && (
          <Field label="Reason for amending this approved record" required>
            <textarea className="input min-h-[70px] border-amber-400" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </Field>
        )}
      </Section>

      <div className="sticky bottom-20 lg:bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 p-3 shadow-glow ring-1 ring-gold-300/40 backdrop-blur">
        <div className="text-sm text-charcoal/70 px-2">
          <span className={`font-bold ${f.metal === 'gold' ? 'text-gold-700' : 'text-silver-600'}`}>{f.metal === 'gold' ? 'Gold' : 'Silver'}</span>
          {' · '}{f.quantity || 0} pc{' · '}<b className="tabular">{f.gross_weight ? grams(Number(f.gross_weight)) : '— g'}</b>
          {' · '}{photos.length + existingPhotos.length - removedPhotos.length} photo(s)
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => nav(-1)}>Cancel</button>
          <button className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : <Icon name="check" />}
            {!isEdit ? t('submitForVerification', 'Save & send for verification') : amend ? 'Save amendment' : 'Save & resubmit'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ n, title, kn, note, children }: { n: number; title: string; kn: string; note?: string; children: ReactNode }) {
  return (
    <section className="card p-5 tablet:p-6 space-y-4 animate-rise">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full metal-gold text-sm font-bold text-maroon-950 shadow">{n}</span>
        <div>
          <h2 className="text-lg font-bold text-maroon-900 leading-tight">{title} <span className="text-sm font-medium text-gold-700">· {kn}</span></h2>
          {note && <div className="text-xs text-charcoal/60">{note}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}
