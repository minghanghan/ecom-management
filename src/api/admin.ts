import api from './index';

// ─── Users ────────────────────────────────────────

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  nickname: string | null;
  role: string;
  store_id: number | null;
  role_id: number | null;
  status: number;
  last_login_at: string | null;
  created_at: string;
  store_name?: string;
  role_name?: string;
}

export async function getUsers() {
  const res = await api.get<AdminUser[]>('/admin/users');
  return res.data;
}

export async function createUser(data: {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
  role?: string;
  store_id?: number;
  role_id?: number;
}) {
  const res = await api.post<AdminUser>('/admin/users', data);
  return res.data;
}

export async function updateUser(id: number, data: Partial<{
  username: string;
  password: string;
  email: string;
  nickname: string;
  role: string;
  store_id: number;
  role_id: number;
  status: number;
  
}>) {
  const res = await api.put<AdminUser>(`/admin/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id: number) {
  const res = await api.delete<{ message: string }>(`/admin/users/${id}`);
  return res.data;
}

// ─── Roles ────────────────────────────────────────

export interface AdminRole {
  id: number;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_system: number;
  created_at: string;
}

export async function getRoles() {
  const res = await api.get<AdminRole[]>('/admin/roles');
  return res.data;
}

export async function createRole(data: { name: string; description?: string; permissions?: Record<string, boolean> }) {
  const res = await api.post<AdminRole>('/admin/roles', data);
  return res.data;
}

export async function updateRole(id: number, data: Partial<{
  name: string;
  description: string;
  permissions: Record<string, boolean>;
}>) {
  const res = await api.put<AdminRole>(`/admin/roles/${id}`, data);
  return res.data;
}

export async function deleteRole(id: number) {
  const res = await api.delete<{ message: string }>(`/admin/roles/${id}`);
  return res.data;
}

// ─── Permissions ─────────────────────────────────

export interface PermissionDef {
  key: string;
  label: string;
  module: string;
}

export async function getPermissionDefs() {
  const res = await api.get<PermissionDef[]>('/admin/permissions');
  return res.data;
}

// ─── Stores ──────────────────────────────────────

export interface AdminStore {
  id: number;
  name: string;
  code: string;
  platform: string;
  status: number;
  remark: string;
  created_at: string;
  updated_at: string;
}

export async function getStores() {
  const res = await api.get<AdminStore[]>('/admin/stores');
  return res.data;
}

export async function getActiveStores() {
  const res = await api.get<{ id: number; name: string; code: string; platform: string }[]>('/admin/stores/active');
  return res.data;
}

export async function createStore(data: { name: string; code: string; platform?: string; remark?: string }) {
  const res = await api.post<AdminStore>('/admin/stores', data);
  return res.data;
}

export async function updateStore(id: number, data: Partial<{
  name: string; code: string; platform: string; status: number; remark: string;
}>) {
  const res = await api.put<AdminStore>(`/admin/stores/${id}`, data);
  return res.data;
}

export async function deleteStore(id: number) {
  const res = await api.delete<{ message: string }>(`/admin/stores/${id}`);
  return res.data;
}
