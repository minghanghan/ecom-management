import api from './index';

export interface DashboardSummary {
  totalProducts: number;
  monthlyOrders: number;
  monthlyRefunds: number;
  monthlyIncome: number;
  monthlyRefundAmount: number;
}

export interface ChartData {
  orderTrend: { date: string; count: number; amount: number }[];
  categoryDist: { category: string; count: number }[];
  statusDist: { status: string; count: number }[];
  refundTrend: { date: string; count: number; amount: number }[];
  incomeExpense: { date: string; income: number; expense: number }[];
}

export async function getDashboardSummary() {
  const res = await api.get<DashboardSummary>('/dashboard/summary');
  return res.data;
}

export async function getDashboardCharts() {
  const res = await api.get<ChartData>('/dashboard/charts');
  return res.data;
}
