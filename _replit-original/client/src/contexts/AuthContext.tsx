import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { AuthUser } from '@/lib/api';

const STORAGE_KEY = 'bayfield_auth';

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isAdmin: boolean;
  isPlayer: (playerId: number) => boolean;
  canEditPlayer: (playerId: number) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  const login = useCallback((u: AuthUser) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isAdmin = user?.type === 'admin';
  const isPlayer = (playerId: number) => user?.type === 'player' && user.id === playerId;
  const canEditPlayer = (playerId: number) => isAdmin || isPlayer(playerId);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isPlayer, canEditPlayer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
