import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type UserInfo, getMe, login as loginApi, register as registerApi, logout as logoutApi } from '../api/auth';
import { getActiveStores } from '../api/admin';
import type { LoginParams, RegisterParams } from '../api/auth';

interface StoreOption {
  id: number;
  name: string;
  code: string;
  platform: string;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (params: LoginParams) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
  stores: StoreOption[];
  selectedStoreId: number | null;
  setSelectedStoreId: (id: number | null) => void;
  refreshStores: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const refreshStores = useCallback(async () => {
    try {
      const list = await getActiveStores();
      setStores(list);
      setSelectedStoreId((prev) => {
        if (prev && !list.some((s) => s.id === prev)) return null;
        return prev;
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    getMe()
      .then((res) => {
        setUser(res.user);
        if (res.user.store_id) {
          setSelectedStoreId(res.user.store_id);
        }
        refreshStores();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshStores();
  }, [refreshStores]);

  const login = async (params: LoginParams) => {
    const res = await loginApi(params);
    setUser(res.user);
    if (res.user.store_id) {
      setSelectedStoreId(res.user.store_id);
    }
    refreshStores();
  };

  const register = async (params: RegisterParams) => {
    const res = await registerApi(params);
    setUser(res.user);
  };

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.user);
    } catch { /* ignore */ }
  }, []);

  const logout = async () => {
    await logoutApi();
    setUser(null);
    setSelectedStoreId(null);
    setStores([]);
  };


  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, stores, selectedStoreId, setSelectedStoreId, refreshStores, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
