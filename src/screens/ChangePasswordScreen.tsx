import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field, PageHeader, Spinner } from '../components/ui';

export default function ChangePasswordScreen({ forced }: { forced?: boolean }) {
  const { refresh, logout, user } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (next !== confirm) return setErr('The two new passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current, next });
      setOk(true);
      await refresh();
      if (!forced) setTimeout(() => nav('/'), 900);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  const form = (
    <form onSubmit={submit} className="card p-6 space-y-4 max-w-md">
      {forced && <p className="text-sm text-charcoal/70">Welcome, <b>{user?.name}</b>. Please set your own password before you continue.</p>}
      <Field label="Current password" required><input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required /></Field>
      <Field label="New password" hint="At least 8 characters, with letters and numbers" required><input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required /></Field>
      <Field label="Confirm new password" required><input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
      <ErrorBox>{err}</ErrorBox>
      {ok && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Password changed.</div>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />}Save password</button>
        {forced && <button type="button" className="btn-ghost" onClick={logout}>Log out</button>}
      </div>
    </form>
  );

  if (!forced) return (<><PageHeader title="Change password" kn="ಪಾಸ್‌ವರ್ಡ್ ಬದಲಿಸಿ" />{form}</>);
  return (
    <div className="temple-bg min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-4 py-1 text-center text-2xl font-bold leading-normal gold-text">Set your password</h1>
        {form}
      </div>
    </div>
  );
}
