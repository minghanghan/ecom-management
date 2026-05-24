import api from './index';

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  price: number;
  cost_price: number;
  sizes: string[];
  colors: string[];
  stock: number;
  description: string | null;
  images: string[];
  status: 'online' | 'offline' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  name: string;
  sku: string;
  category?: string;
  price?: number;
  cost_price?: number;
  sizes?: string[];
  colors?: string[];
  stock?: number;
  description?: string;
  images?: string[];
  status?: 'online' | 'offline';
}

export interface PaginatedResult<T> {
  products: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BatchAction {
  ids: number[];
  action: 'online' | 'offline' | 'delete';
}

export async function getProducts(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
  sortField?: string;
  sortOrder?: string;
}) {
  const res = await api.get<PaginatedResult<Product>>('/products', { params });
  return res.data;
}

export async function getCategories() {
  const res = await api.get<string[]>('/products/categories');
  return res.data;
}

export async function getProduct(id: number) {
  const res = await api.get<Product>(`/products/${id}`);
  return res.data;
}

export async function createProduct(data: ProductFormData) {
  const res = await api.post<Product>('/products', data);
  return res.data;
}

export async function updateProduct(id: number, data: Partial<ProductFormData>) {
  const res = await api.put<Product>(`/products/${id}`, data);
  return res.data;
}

export async function deleteProduct(id: number) {
  const res = await api.delete<{ message: string }>(`/products/${id}`);
  return res.data;
}

export async function batchAction(data: BatchAction) {
  const res = await api.post<{ message: string }>('/products/batch', data);
  return res.data;
}
