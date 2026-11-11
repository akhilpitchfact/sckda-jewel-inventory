import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { IS_DEMO, loadDemo } from '../api';
import { useI18n } from '../i18n';
import { Icon, Mandala, ROLE_LABEL } from './ui';

interface NavItem { to: string; key: string; en: string; icon: string; perm?: string }

const NAV: NavItem[] = [
  { to: '/', key: 'dashboard', en: 'Dashboard', icon: 'dashboard' },
  { to: '/new', key: 'newArticle', en: 'Register Article', icon: 'plus', perm: 'article.create' },
  { to: '/inventory', key: 'inventory', en: 'Inventory', icon: 'list' },
  { to: '/verification', key: 'verification', en: 'Verification', icon: 'check', perm: 'article.verify' },
  { to: '/reports', key: 'reports', en: 'Reports', icon: 'report', perm: 'reports.view' },
  { to: '/audit', key: 'auditLog', en: 'Audit Trail', icon: 'audit', perm: 'audit.view' },
  { to: '/users', key: 'users', en: 'Users', icon: 'users', perm: 'users.manage' },
  { to: '/categories', key: 'settings', en: 'Categories', icon: 'tag', perm: 'settings.manage' },
];

export default function Shell({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  const items = NAV.filter((n) => !n.perm || can(n.perm));
  const role = user ? ROLE_LABEL[user.role] : null;

  const LangToggle = (
    <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-semibold ring-1 ring-white/15">
      {(['en', 'kn'] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 transition ${lang === l ? 'bg-gold-300 text-maroon-950' : 'text-white/80 hover:text-white'}`}>
          {l === 'en' ? 'EN' : 'ಕನ್ನಡ'}
        </button>
      ))}
    </div>
  );

  const sidebar = (
    <div className="temple-bg relative flex h-full flex-col overflow-hidden text-white">
      <Mandala className="pointer-events-none absolute -right-28 -top-28 w-80 h-80 text-gold-300/10 animate-spin-slower" />
      <div className="relative flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-full metal-gold opacity-80 blur-[2px]" />
          <img src="/logo-sckda.png" alt="SCKDA" className="relative w-12 h-12 rounded-full bg-white p-0.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] leading-tight text-gold-200/80">ಶ್ರೀ ಚಾಮುಂಡೇಶ್ವರಿ ಕ್ಷೇತ್ರ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ</div>
          <div className="font-bold leading-snug gold-text text-[15px] py-0.5">Gold &amp; Silver Inventory</div>
        </div>
      </div>
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent" />
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
                isActive ? 'bg-gradient-to-r from-gold-300/25 to-gold-300/5 text-gold-100 ring-1 ring-gold-300/30' : 'text-white/75 hover:bg-white/5 hover:text-white'}`}>
            {({ isActive }) => (<>
              <span className={`grid place-items-center w-8 h-8 rounded-lg ${isActive ? 'metal-gold text-maroon-950' : 'bg-white/5 text-gold-200'}`}>
                <Icon name={n.icon} className="w-[18px] h-[18px]" />
              </span>
              {t(n.key, n.en)}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="relative m-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-10 h-10 shrink-0 rounded-full metal-gold text-maroon-950 font-bold">
            {user?.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-sm">{user?.name}</div>
            <div className="truncate text-xs text-gold-200/80">{role && t('', lang === 'kn' ? role.kn : role.en)}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {LangToggle}
          <div className="flex gap-1">
            <button type="button" title="Change password" onClick={() => nav('/password')} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="key" className="w-4 h-4" /></button>
            <button type="button" title={t('logout', 'Log out')} onClick={logout} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="logout" className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-72">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 lg:hidden temple-bg text-white shadow-lg">
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
          <button type="button" onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 hover:bg-white/10" aria-label="Menu"><Icon name="menu" /></button>
          <img src="/logo-sckda.png" alt="" className="w-9 h-9 rounded-full bg-white p-0.5 ring-2 ring-gold-300/70" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] text-gold-200/80">ಶ್ರೀ ಚಾಮುಂಡೇಶ್ವರಿ ಕ್ಷೇತ್ರ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ</div>
            <div className="truncate text-sm font-bold leading-snug gold-text">Gold &amp; Silver Inventory</div>
          </div>
          {LangToggle}
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs shadow-2xl animate-rise" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}

      {IS_DEMO && (
        <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gold-200 px-4 py-1.5 text-center text-xs font-semibold text-maroon-900">
          <span>Demo with sample data. Nothing here is real, and changes stay in this browser.</span>
          <button type="button" className="underline underline-offset-2 hover:text-maroon-700"
            onClick={async () => { await (await loadDemo()).resetDemo(); window.location.href = '/'; }}>Reset demo</button>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6 tablet:px-6 lg:px-10 lg:py-10 pb-28 lg:pb-10">{children}</main>

      {/* Mobile bottom bar: the most used actions */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {items.filter((n) => ['/', '/new', '/inventory', '/verification', '/reports'].includes(n.to)).slice(0, 4).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-maroon-700' : 'text-charcoal/50'}`}>
              {({ isActive }) => (<>
                <span className={`grid place-items-center w-10 h-7 rounded-full ${isActive ? 'metal-gold text-maroon-950' : ''}`}><Icon name={n.icon} className="w-5 h-5" /></span>
                <span className="truncate max-w-full px-1">{t(n.key, n.en)}</span>
              </>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
