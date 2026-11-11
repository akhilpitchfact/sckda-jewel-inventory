import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { Metal, Role, Source, Status } from '../types';

export const ROLE_LABEL: Record<Role, { en: string; kn: string }> = {
  superadmin: { en: 'Super Administrator', kn: 'ಸೂಪರ್ ನಿರ್ವಾಹಕ' },
  inventory: { en: 'Inventory Officer', kn: 'ದಾಸ್ತಾನು ಅಧಿಕಾರಿ' },
  verifier: { en: 'Verification Officer', kn: 'ಪರಿಶೀಲನಾ ಅಧಿಕಾರಿ' },
  accounts: { en: 'Accounts Officer', kn: 'ಲೆಕ್ಕ ಅಧಿಕಾರಿ' },
  management: { en: 'Management / Authority', kn: 'ಆಡಳಿತ / ಪ್ರಾಧಿಕಾರ' },
};

/** Decorative temple mandala, drawn in SVG so it stays sharp at any size. */
export function Mandala({ className = '', petals = 24 }: { className?: string; petals?: number }) {
  const rings = [
    { r: 96, n: petals, len: 26, w: 9 },
    { r: 66, n: petals / 2, len: 22, w: 10 },
    { r: 40, n: petals / 3, len: 18, w: 9 },
  ];
  return (
    <svg viewBox="-120 -120 240 240" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        {[112, 100, 78, 52, 28, 12].map((r) => <circle key={r} r={r} />)}
        {rings.map((ring, ri) =>
          Array.from({ length: ring.n }).map((_, i) => (
            <path
              key={`${ri}-${i}`}
              transform={`rotate(${(360 / ring.n) * i + (ri % 2 ? 360 / ring.n / 2 : 0)})`}
              d={`M0,-${ring.r - ring.len} C${ring.w},-${ring.r - ring.len / 2} ${ring.w / 2},-${ring.r} 0,-${ring.r + 4} C-${ring.w / 2},-${ring.r} -${ring.w},-${ring.r - ring.len / 2} 0,-${ring.r - ring.len}Z`}
            />
          )),
        )}
        {Array.from({ length: petals * 2 }).map((_, i) => (
          <circle key={`d${i}`} r="1.4" cx="0" cy="-106" transform={`rotate(${(360 / (petals * 2)) * i})`} fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}

export function Splash() {
  return (
    <div className="temple-bg min-h-dvh grid place-items-center">
      <div className="relative w-40 h-40 text-gold-300/60">
        <Mandala className="absolute inset-0 animate-spin-slower" />
        <img src="/logo-sckda.png" alt="" className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white p-1" />
      </div>
    </div>
  );
}

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function Loading() {
  return <div className="py-20 grid place-items-center text-maroon-700"><Spinner className="w-8 h-8" /></div>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{children}</div>;
}

export function MetalBadge({ metal, size = 'sm' }: { metal: Metal; size?: 'sm' | 'lg' }) {
  const { t } = useI18n();
  const cls = metal === 'gold' ? 'metal-gold text-gold-800 ring-gold-400/60' : 'metal-silver text-silver-700 ring-silver-400/60';
  return (
    <span className={`chip ring-1 ${cls} ${size === 'lg' ? 'px-3 py-1 text-sm' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${metal === 'gold' ? 'bg-gold-700' : 'bg-silver-600'}`} />
      {metal === 'gold' ? t('gold', 'Gold') : t('silver', 'Silver')}
    </span>
  );
}

export function SourceBadge({ source }: { source: Source }) {
  const { t } = useI18n();
  return source === 'hundi'
    ? <span className="chip bg-maroon-50 text-maroon-700 ring-1 ring-maroon-200">{t('hundi', 'Hundi')}</span>
    : <span className="chip bg-saffron-300/30 text-saffron-700 ring-1 ring-saffron-400/50">{t('seva', 'Seva')}</span>;
}

const STATUS_CLS: Record<Status, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  returned: 'bg-red-50 text-red-700 ring-red-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200 line-through',
};
const STATUS_EN: Record<Status, string> = { pending: 'Pending verification', returned: 'Returned for correction', approved: 'Approved', cancelled: 'Cancelled' };

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  return (
    <span className={`chip ring-1 ${STATUS_CLS[status]}`}>
      {status === 'approved' && <svg viewBox="0 0 20 20" className="w-3 h-3" fill="currentColor"><path d="M7.6 14.2 3.4 10l1.4-1.4 2.8 2.8 7.6-7.6 1.4 1.4z" /></svg>}
      {t(status, STATUS_EN[status])}
    </span>
  );
}

export function PageHeader({ title, kn, subtitle, actions }: { title: string; kn?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6 animate-rise">
      <div className="min-w-0">
        {kn && <div className="text-sm font-medium text-gold-700">{kn}</div>}
        <h1 className="text-2xl tablet:text-3xl font-bold text-maroon-900 leading-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-charcoal/60">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, required, children, className = '' }: { label: ReactNode; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}{required && <span className="text-maroon-600"> *</span>}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end tablet:items-center justify-center bg-maroon-950/60 backdrop-blur-sm p-0 tablet:p-6" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'tablet:max-w-3xl' : 'tablet:max-w-lg'} max-h-[92dvh] overflow-auto rounded-t-3xl tablet:rounded-3xl bg-white shadow-glow animate-rise`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cream-200 bg-white/95 backdrop-blur px-5 py-4">
          <h2 className="text-lg font-bold text-maroon-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-cream-100" aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" strokeWidth="2" fill="none"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Animated number that counts up when it changes. */
export function CountUp({ value, decimals = 0, duration = 1100 }: { value: number; decimals?: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-16 text-center">
      <Mandala className="mx-auto w-20 h-20 text-gold-300" petals={12} />
      <div className="mt-3 font-semibold text-charcoal/70">{title}</div>
      {children && <div className="mt-1 text-sm text-charcoal/50">{children}</div>}
    </div>
  );
}

export function Icon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" />,
    plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />,
    check: <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />,
    report: <path d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" strokeLinecap="round" />,
    audit: <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" />,
    users: <path d="M17 20h5v-2a3 3 0 0 0-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 0 1 5.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 0 1 9.28 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" strokeLinecap="round" />,
    tag: <path d="M7 7h.01M7 3h5c.5 0 1 .2 1.4.6l7 7a2 2 0 0 1 0 2.8l-7 7a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" strokeLinecap="round" />,
    camera: <><path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.66-.9l.82-1.2A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3" /></>,
    image: <path d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" strokeLinecap="round" />,
    logout: <path d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" strokeLinecap="round" />,
    key: <path d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.74 5.74L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.59a1 1 0 0 1 .29-.7l5.97-5.97A6 6 0 1 1 21 9z" strokeLinecap="round" />,
    scale: <path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zm14 0-3 7a4 4 0 0 0 6 0zM8 21h8" strokeLinecap="round" strokeLinejoin="round" />,
    search: <path d="M21 21l-5.2-5.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" strokeLinecap="round" />,
    download: <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" strokeLinecap="round" />,
    edit: <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.4-9.4a2 2 0 1 1 2.8 2.8L11.8 15H9v-2.8z" strokeLinecap="round" />,
    trash: <path d="M19 7l-.87 12.14A2 2 0 0 1 16.14 21H7.86a2 2 0 0 1-2-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" strokeLinecap="round" />,
    lock: <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" strokeLinecap="round" />,
    print: <path d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z" strokeLinecap="round" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />,
    back: <path d="M15 19l-7-7 7-7" strokeLinecap="round" />,
  };
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">{paths[name]}</svg>;
}
