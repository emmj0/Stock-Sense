import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe, googleLogin, login, signup } from '../api';
import { getStoredToken, setAuthToken } from '../api/client';
import type { AuthResponse, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authenticateWithPassword: (email: string, password: string) => Promise<void>;
  authenticateWithGoogle: (idToken: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function handleAuth({ token, user }: AuthResponse, setUser: (u: User) => void) {
  setAuthToken(token);
  setUser(user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setAuthToken(token);
    fetchMe()
      .then((me) => setUser(me))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  const authenticateWithPassword = async (email: string, password: string) => {
    const res = await login({ email, password });
    handleAuth(res, setUser);
    const me = await fetchMe();
    setUser(me);
  };

  const authenticateWithGoogle = async (idToken: string) => {
    const res = await googleLogin(idToken);
    handleAuth(res, setUser);
    const me = await fetchMe();
    setUser(me);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await signup({ name, email, password });
    handleAuth(res, setUser);
  };

  const refreshUser = async () => {
    const me = await fetchMe();
    setUser(me);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, authenticateWithPassword, authenticateWithGoogle, register, refreshUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
