import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { ErrorBox, Field, Icon, Loading, Modal, PageHeader, ROLE_LABEL, Spinner } from '../components/ui';
import { dateTime } from '../format';
import type { Role } from '../types';

interface U { id: number; username: string; name: string; designation: string | null; mobile: string | null; role: Role; active: number; must_change_password: number; last_login_at: string | null; locked: number }

const ROLE_DESC: Record<Role, string> = {
  superadmin: 'Full control, user management, amend or cancel approved records',
  inventory: 'Registers articles, photos and weights',
  verifier: 'Verifies and approves, or returns for correction',
  accounts: 'Inventory statements, accounting reports, audit trail',
  management: 'Dashboard and reports (donor details hidden)',
};

const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const r = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(r.slice(0, 6), (n) => chars[n % chars.length]).join('') + String(10 + (r[6] % 90));
};

export default function UsersScreen() {
  const { user: me } = useAuth();
  const { lang } = useI18n();
  const [users, setUsers] = useState<U[] | null>(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<U | 'new' | null>(null);
  const [reset, setReset] = useState<U | null>(null);
  const load = () => api.get<U[]>('/users').then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Users & roles" kn="ಬಳಕೆದಾರರು ಮತ್ತು ಪಾತ್ರಗಳು" subtitle="Each officer gets their own login. Every action is recorded against their name."
        actions={<button type="button" className="btn-primary" onClick={() => setEdit('new')}><Icon name="plus" />Add user</button>} />
      <ErrorBox>{err}</ErrorBox>
      <div className="mb-6 grid gap-3 tablet:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <div key={r} className="rounded-2xl bg-white p-4 ring-1 ring-cream-200">
            <div className="text-xs text-gold-700">{ROLE_LABEL[r].kn}</div>
            <div className="font-bold text-maroon-900">{ROLE_LABEL[r].en}</div>
            <div className="mt-1 text-xs text-charcoal/60">{ROLE_DESC[r]}</div>
            <div className="mt-2 text-2xl font-bold tabular">{users?.filter((u) => u.role === r && u.active).length ?? '–'}</div>
          </div>
        ))}
      </div>
      {!users ? <Loading /> : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Last login</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                  <td><div className="font-semibold">{u.name}</div><div className="text-xs text-charcoal/50">{[u.designation, u.mobile].filter(Boolean).join(' · ')}</div></td>
                  <td className="font-mono">{u.username}</td>
                  <td>{lang === 'kn' ? ROLE_LABEL[u.role].kn : ROLE_LABEL[u.role].en}</td>
                  <td className="whitespace-nowrap text-charcoal/70">{u.last_login_at ? dateTime(u.last_login_at) : 'Never'}</td>
                  <td>
                    {!u.active ? <span className="chip bg-gray-100 text-gray-600">Disabled</span>
                      : u.locked ? <span className="chip bg-red-50 text-red-700">Locked</span>
                      : u.must_change_password ? <span className="chip bg-amber-50 text-amber-800">Temporary password</span>
                      : <span className="chip bg-emerald-50 text-emerald-800">Active</span>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(u)}>Edit</button>{' '}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setReset(u)}>Reset password</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <UserModal u={edit === 'new' ? null : edit} self={edit !== 'new' && edit.id === me?.id} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
      {reset && <ResetModal u={reset} onClose={() => setReset(null)} onDone={() => { setReset(null); load(); }} />}
    </div>
  );
}

function UserModal({ u, self, onClose, onDone }: { u: U | null; self: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ username: u?.username || '', name: u?.name || '', designation: u?.designation || '', mobile: u?.mobile || '', role: u?.role || 'inventory' as Role, active: u ? !!u.active : true, password: genPassword() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (u) await api.patch(`/users/${u.id}`, { name: f.name, designation: f.designation, mobile: f.mobile, role: f.role, active: f.active });
      else await api.post('/users', f);
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={u ? `Edit ${u.name}` : 'Add user'}>
      <div className="space-y-4">
        {!u && <Field label="Username" required hint="Used to log in. Letters, numbers, dot, dash."><input className="input font-mono" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.trim() })} /></Field>}
        <Field label="Full name" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label="Designation"><input className="input" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></Field>
          <Field label="Mobile"><input className="input" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
        </div>
        <Field label="Role" required>
          <select className="input" value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r].en} · {ROLE_LABEL[r].kn}</option>)}
          </select>
        </Field>
        {!u && <Field label="Temporary password" hint="Give this to the officer. They must change it at first login."><input className="input font-mono" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>}
        {u && !self && <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 accent-maroon-700" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>Account active (untick to disable login)</span></label>}
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />}Save</button></div>
      </div>
    </Modal>
  );
}

function ResetModal({ u, onClose, onDone }: { u: U; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal open onClose={onClose} title={`Reset password for ${u.name}`}>
      <Field label="New temporary password" hint="They will be asked to change it at next login. Their open sessions are ended."><input className="input font-mono" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await api.post(`/users/${u.id}/reset-password`, { password: pw }); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>{busy && <Spinner />}Reset password</button>
      </div>
    </Modal>
  );
}
