import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { ErrorBox, Mandala, Spinner } from '../components/ui';

export default function LoginScreen() {
  const { refresh } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/login', { username, password });
      await refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="temple-bg relative min-h-dvh overflow-hidden text-white">
      {/* Layered mandalas */}
      <Mandala className="pointer-events-none absolute left-1/2 top-1/2 w-[140vmax] h-[140vmax] -translate-x-1/2 -translate-y-1/2 text-gold-300/[0.06] animate-spin-slower" petals={36} />
      <Mandala className="pointer-events-none absolute -right-40 -bottom-40 w-[36rem] h-[36rem] text-gold-300/10" petals={24} />
      {/* Floating glints */}
      {[[12, 20], [80, 14], [70, 78], [18, 82], [50, 8], [90, 50]].map(([x, y], i) => (
        <span key={i} className="pointer-events-none absolute w-1 h-1 rounded-full bg-gold-200 shadow-[0_0_12px_4px_rgba(236,201,106,.6)] animate-glint"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.5}s` }} />
      ))}

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-5 py-10">
        <div className="absolute right-4 top-4 flex rounded-full bg-white/10 p-0.5 text-xs font-semibold ring-1 ring-white/15">
          {(['en', 'kn'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1.5 ${lang === l ? 'bg-gold-300 text-maroon-950' : 'text-white/80'}`}>{l === 'en' ? 'EN' : 'ಕನ್ನಡ'}</button>
          ))}
        </div>

        <div className="relative mb-6 animate-rise">
          <div className="absolute -inset-3 rounded-full metal-gold opacity-70 blur-md" />
          <div className="relative rounded-full p-1 metal-gold">
            <img src="/logo-sckda.png" alt="SCKDA" className="w-24 h-24 rounded-full bg-white p-1" />
          </div>
        </div>

        <div className="text-center animate-rise" style={{ animationDelay: '.08s' }}>
          <div className="text-sm tablet:text-base text-gold-200/90">ಶ್ರೀ ಚಾಮುಂಡೇಶ್ವರಿ ಕ್ಷೇತ್ರ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ</div>
          <div className="text-xs tablet:text-sm text-white/60">Sri Chamundeshwari Kshetra Development Authority, Mysuru</div>
          <h1 className="mt-4 py-1 text-3xl tablet:text-5xl font-bold leading-normal gold-text">
            {lang === 'kn' ? 'ಚಿನ್ನ ಮತ್ತು ಬೆಳ್ಳಿ' : 'Gold & Silver'}
          </h1>
          <div className="text-lg tablet:text-2xl font-semibold text-gold-100/90">
            {lang === 'kn' ? 'ವಸ್ತುಗಳ ಲೆಕ್ಕ ಮತ್ತು ದಾಸ್ತಾನು' : 'Articles Accounting & Inventory'}
          </div>
        </div>

        <form onSubmit={submit}
          className="mt-8 w-full max-w-sm rounded-3xl bg-white/[0.07] p-6 shadow-glow ring-1 ring-gold-300/25 backdrop-blur-xl animate-rise"
          style={{ animationDelay: '.16s' }}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gold-100/90">{t('username', 'Username')}</span>
            <input className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-300/20"
              value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-gold-100/90">{t('password', 'Password')}</span>
            <input type="password" className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-300/20"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {err && <div className="mt-4"><ErrorBox>{err}</ErrorBox></div>}
          <button type="submit" disabled={busy} className="btn-gold sheen mt-6 w-full text-base">
            {busy ? <Spinner /> : null}{t('login', 'Log in')}
          </button>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/50">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" /></svg>
            Authorised officials only. All activity is recorded.
          </div>
        </form>

        <div className="mt-10 text-[11px] text-white/40">Developed by Pitchfact Digital Technologies</div>
      </div>
    </div>
  );
}
