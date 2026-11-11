import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBox, Icon, Loading, MetalBadge, PageHeader, Spinner } from '../components/ui';
import type { Category, Metal } from '../types';

export default function CategoriesScreen() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [err, setErr] = useState('');
  const load = () => api.get<Category[]>('/categories').then(setCats).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Article categories" kn="ವಸ್ತು ವರ್ಗಗಳು" subtitle="The categories from the proposal are set up. Add more as needed. Categories in use can be hidden but not deleted." />
      <ErrorBox>{err}</ErrorBox>
      {!cats ? <Loading /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(['gold', 'silver'] as Metal[]).map((m) => <MetalList key={m} metal={m} cats={cats.filter((c) => c.metal === m)} onChange={load} />)}
        </div>
      )}
    </div>
  );
}

function MetalList({ metal, cats, onChange }: { metal: Metal; cats: Category[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [kn, setKn] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try { await api.post('/categories', { metal, name, name_kn: kn }); setName(''); setKn(''); onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card overflow-hidden">
      <div className={`px-5 py-4 ${metal === 'gold' ? 'metal-gold' : 'metal-silver'}`}><MetalBadge metal={metal} size="lg" /> <span className="ml-2 font-bold">{metal === 'gold' ? 'Gold inventory' : 'Silver inventory'}</span></div>
      <ul className="divide-y divide-cream-200">
        {cats.map((c) => (
          <li key={c.id} className={`flex items-center gap-3 px-5 py-3 ${c.active ? '' : 'opacity-50'}`}>
            <div className="flex-1"><div className="font-semibold">{c.name}</div><div className="text-sm text-charcoal/60">{c.name_kn}</div></div>
            <button type="button" className="btn-ghost btn-sm" onClick={async () => { await api.patch(`/categories/${c.id}`, { active: !c.active }); onChange(); }}>{c.active ? 'Hide' : 'Show'}</button>
          </li>
        ))}
      </ul>
      <div className="border-t border-cream-200 bg-cream-50 p-4 space-y-2">
        <div className="grid gap-2 tablet:grid-cols-2">
          <input className="input" placeholder="New category (English)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="ಕನ್ನಡ ಹೆಸರು" value={kn} onChange={(e) => setKn(e.target.value)} />
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
        <button type="button" className="btn-primary btn-sm" disabled={busy || !name.trim()} onClick={add}>{busy ? <Spinner /> : <Icon name="plus" className="w-4 h-4" />}Add category</button>
      </div>
    </section>
  );
}
