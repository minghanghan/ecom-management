import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type UserInfo, getMe, login as loginApi, register as registerApi, logout as logoutApi } from '../api/auth';
import type { LoginParams, RegisterParams } from '../api/auth';

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (params: LoginParams) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (params: LoginParams) => {
    const res = await loginApi(params);
    setUser(res.user);
  };

  const register = async (params: RegisterParams) => {
    const res = await registerApi(params);
    setUser(res.user);
  };

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
