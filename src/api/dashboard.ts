import api from './index';

export interface DashboardSummary {
  totalProducts: number;
  monthlyOrders: number;
  monthlyIncome: number;
  monthlyRefunds: number;
}

export interface ChartData {
  orderTrend: { date: string; count: number; amount: number }[];
  statusDist: { status: string; count: number }[];
  platformDist: { platform: string; count: number; amount: number }[];
}

export async function getDashboardSummary(storeId?: number | null) {
  const res = await api.get<DashboardSummary>('/dashboard/summary', {
    params: storeId ? { store_id: storeId } : {},
  });
  return res.data;
}

export async function getDashboardCharts(storeId?: number | null) {
  const res = await api.get<ChartData>('/dashboard/charts', {
    params: storeId ? { store_id: storeId } : {},
  });
  return res.data;
}
