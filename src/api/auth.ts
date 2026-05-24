import api from './index';

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
  role?: string;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string | null;
  nickname: string | null;
  role: string;
  role_name: string | null;
  store_id: number | null;
  role_id: number | null;
  permissions: Record<string, boolean>;
  status: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function login(params: LoginParams) {
  const res = await api.post<{ user: UserInfo; message: string }>('/auth/login', params);
  return res.data;
}

export async function register(params: RegisterParams) {
  const res = await api.post<{ user: UserInfo; message: string }>('/auth/register', params);
  return res.data;
}

export async function getMe() {
  const res = await api.get<{ user: UserInfo }>('/auth/me');
  return res.data;
}

export async function logout() {
  await api.post('/auth/logout');
}
