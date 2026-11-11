import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  permissions: string[];
  loading: boolean;
  can: (perm: string) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<{ user: User; permissions: string[] }>('/auth/me');
      setUser(me.user);
      setPermissions(me.permissions);
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onOut = () => { setUser(null); setPermissions([]); };
    const onMust = () => refresh();
    window.addEventListener('sckda:logged-out', onOut);
    window.addEventListener('sckda:must-change-password', onMust);
    return () => {
      window.removeEventListener('sckda:logged-out', onOut);
      window.removeEventListener('sckda:must-change-password', onMust);
    };
  }, [refresh]);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setPermissions([]);
  };

  return (
    <Ctx.Provider value={{ user, permissions, loading, can: (p) => permissions.includes(p), refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
