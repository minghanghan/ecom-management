import api from './index';

export interface Requirement {
  id: number;
  product_name: string;
  product_sku: string;
  links: string[];
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee_id: number | null;
  created_by: number;
  creator_name?: string;
  assignee_name?: string | null;
  store_id?: number | null;
  store_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequirementFormData {
  product_name: string;
  product_sku: string;
  links?: string[];
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  store_id?: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function getRequirements(params: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const res = await api.get<PaginatedResult<Requirement>>('/requirements', { params });
  return res.data;
}

export async function getRequirement(id: number) {
  const res = await api.get<Requirement>(`/requirements/${id}`);
  return res.data;
}

export async function createRequirement(data: RequirementFormData) {
  const res = await api.post<Requirement>('/requirements', data);
  return res.data;
}

export async function updateRequirement(id: number, data: Partial<RequirementFormData>) {
  const res = await api.put<Requirement>(`/requirements/${id}`, data);
  return res.data;
}

export async function deleteRequirement(id: number) {
  const res = await api.delete<{ message: string }>(`/requirements/${id}`);
  return res.data;
}
