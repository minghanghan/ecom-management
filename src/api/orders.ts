import api from './index';

export interface Order {
  id: number;
  order_no: string;
  platform: string;
  product_name: string | null;
  product_sku: string | null;
  product_specs: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  discount: number;
  actual_amount: number;
  status: string;
  refund_status: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  shipping_address: string | null;
  shipping_method: string | null;
  tracking_no: string | null;
  buyer_remark: string | null;
  seller_remark: string | null;
  order_date: string | null;
  payment_date: string | null;
  shipping_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFormData {
  order_no?: string;
  platform?: string;
  product_name?: string;
  product_sku?: string;
  product_specs?: string;
  quantity?: number;
  unit_price?: number;
  total_amount?: number;
  discount?: number;
  actual_amount?: number;
  buyer_name?: string;
  buyer_phone?: string;
  shipping_address?: string;
  shipping_method?: string;
  tracking_no?: string;
  buyer_remark?: string;
  seller_remark?: string;
  order_date?: string;
}

export interface PaginatedOrders {
  orders: Order[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: Record<string, number>;
}

export async function getOrders(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  platform?: string;
  status?: string;
  refundStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortOrder?: string;
  store_id?: number | null;
}) {
  const res = await api.get<PaginatedOrders>('/orders', { params });
  return res.data;
}

export async function getOrderStats() {
  const res = await api.get<Record<string, number>>('/orders/stats');
  return res.data;
}

export async function getOrder(id: number) {
  const res = await api.get<Order>(`/orders/${id}`);
  return res.data;
}

export async function createOrder(data: OrderFormData) {
  const res = await api.post<Order>('/orders', data);
  return res.data;
}

export async function updateOrder(id: number, data: Partial<OrderFormData>) {
  const res = await api.put<Order>(`/orders/${id}`, data);
  return res.data;
}

export async function deleteOrder(id: number) {
  const res = await api.delete<{ message: string }>(`/orders/${id}`);
  return res.data;
}

export async function batchDeleteOrders(ids: number[]) {
  const res = await api.delete<{ message: string; deleted: number }>('/orders/batch', { data: { ids } });
  return res.data;
}

export async function transitionOrderStatus(id: number, status: string) {
  const res = await api.put<Order>(`/orders/${id}/status`, { status });
  return res.data;
}

export async function setRefundStatus(id: number, refund_status: string, seller_remark?: string) {
  const res = await api.put<Order>(`/orders/${id}/refund`, { refund_status, seller_remark });
  return res.data;
}

export async function importOrders(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<{
    message: string;
    imported: number;
    skipped: number;
    errors: string[];
    headers?: string[];
  }>('/orders/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function exportOrders(params: {
  platform?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await api.get('/orders/export', {
    params,
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${Date.now()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
