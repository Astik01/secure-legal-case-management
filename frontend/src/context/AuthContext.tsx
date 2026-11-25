import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../services/api';
import { authApi } from '../services/endpoints';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Parameters<typeof authApi.register>[0]) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser((await authApi.me()).user);
    } catch (e) {
      // 401 simply means "not signed in"; anything else is surfaced by the calling page.
      if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 403)) console.error(e);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      login: async (email, password) => {
        const { user: u } = await authApi.login(email, password);
        setUser(u);
        return u;
      },
      register: async (body) => {
        const { user: u } = await authApi.register(body);
        setUser(u);
        return u;
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setUser(null);
        }
      },
    }),
    [user, loading, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const homeFor = (role: User['role']) => (role === 'ADMIN' ? '/admin' : role === 'FACULTY' ? '/faculty' : '/student');
