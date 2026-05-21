import { useEffect, useState } from 'react';
import { Typography, Card, Row, Col, Spin, Statistic } from 'antd';
import { ShoppingOutlined, ShoppingCartOutlined, ExclamationCircleOutlined, DollarOutlined } from '@ant-design/icons';
import EChartsWrapper from '../../components/EChartsWrapper';
import { useAuth } from '../../context/AythContext';
import { getDashboardSummary, getDashboardCharts } from '../../api/dashboard';
import type { DashboardSummary, ChartData } from '../../api/dashboard';
import './style.css';

const { Title } = Typography;

const STATUS_MAP: Record<string, string> = {
  pending: '待处理', processing: '处理中', shipped: '已发货',
  completed: '已完成', cancelled: '已取消', refunded: '已退款',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#faad14', processing: '#1890ff', shipped: '#722ed1',
  completed: '#52c41a', cancelled: '#d9d9d9', refunded: '#ff4d4f',
};

export default function DashboardPage() {
  const fmtDate = (iso: string) => iso.split('T')[0].slice(5); // "2026-04-21T16:00:00.000Z" → "04-21"
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardSummary(), getDashboardCharts()])
      .then(([s, c]) => { setSummary(s); setCharts(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="dashboard-loading"><Spin size="large" /></div>;

  const orderTrendOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 10, right: 20, bottom: 36, left: 44 },
    xAxis: {
      type: 'category' as const,
      data: charts?.orderTrend.map(d => fmtDate(d.date)) || [],
      axisLabel: { fontSize: 11, rotate: 45, interval: 'auto', margin: 8 },
    },
    yAxis: { type: 'value' as const, minInterval: 1 },
    series: [
      { name: '订单数', type: 'line', data: charts?.orderTrend.map(d => d.count) || [], smooth: true, lineStyle: { color: '#3b82f6', width: 2 }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: 'rgba(59,130,246,0.1)' } },
    ],
  };

  const categoryOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 10, right: 20, bottom: 24, left: 44 },
    xAxis: { type: 'category' as const, data: charts?.categoryDist.map(d => d.category) || [], axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value' as const, minInterval: 1 },
    series: [{ type: 'bar', data: charts?.categoryDist.map(d => d.count) || [], itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }, barWidth: 32 }],
  };

  const statusOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}单 ({d}%)' },
    series: [{
      type: 'pie', radius: ['42%', '70%'], center: ['50%', '50%'],
      data: charts?.statusDist.map(d => ({
        name: STATUS_MAP[d.status] || d.status,
        value: d.count,
        itemStyle: { color: STATUS_COLORS[d.status] || '#3b82f6' },
      })) || [],
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
    }],
  };

  const refundOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { top: 10, right: 20, bottom: 36, left: 44 },
    xAxis: {
      type: 'category' as const,
      data: charts?.refundTrend.map(d => fmtDate(d.date)) || [],
      axisLabel: { fontSize: 11, rotate: 45, interval: 'auto', margin: 8 },
    },
    yAxis: { type: 'value' as const, minInterval: 1 },
    series: [{ name: '退款金额', type: 'line', data: charts?.refundTrend.map(d => d.amount) || [], smooth: true, lineStyle: { color: '#ff4d4f', width: 2 }, itemStyle: { color: '#ff4d4f' }, areaStyle: { color: 'rgba(255,77,79,0.1)' } }],
  };

  const incomeExpenseOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['收入', '支出'], bottom: 0, icon: 'circle', itemWidth: 8 },
    grid: { top: 10, right: 20, bottom: 40, left: 44 },
    xAxis: {
      type: 'category' as const,
      data: charts?.incomeExpense.map(d => fmtDate(d.date)) || [],
      axisLabel: { fontSize: 11, rotate: 45, interval: 'auto', margin: 8 },
    },
    yAxis: { type: 'value' as const },
    series: [
      { name: '收入', type: 'bar', data: charts?.incomeExpense.map(d => d.income) || [], itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] }, barWidth: 12 },
      { name: '支出', type: 'bar', data: charts?.incomeExpense.map(d => d.expense) || [], itemStyle: { color: '#ff4d4f', borderRadius: [4, 4, 0, 0] }, barWidth: 12 },
    ],
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <Title level={4} style={{ margin: 0 }}>欢迎回来，{user?.nickname || user?.username}</Title>
          <span className="dashboard-role">{
            { admin: '管理员', manager: '普通管理', artist: '美工师', user: '普通用户' }[user?.role || ''] || ''
          }</span>
        </div>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} className="dashboard-cards">
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card stat-card-blue">
            <Statistic title="商品总数" value={summary?.totalProducts || 0} prefix={<ShoppingOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card stat-card-green">
            <Statistic title="本月订单" value={summary?.monthlyOrders || 0} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card stat-card-orange">
            <Statistic title="本月售后" value={summary?.monthlyRefunds || 0} prefix={<ExclamationCircleOutlined />} suffix={`单`} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card stat-card-purple">
            <Statistic title="本月收入" value={summary?.monthlyIncome || 0} prefix={<DollarOutlined />} precision={2} suffix="元" />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} className="dashboard-charts">
        <Col xs={24} lg={14}>
          <Card title="近30天订单趋势" className="chart-card">
            <EChartsWrapper option={orderTrendOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="各品类商品销量分布" className="chart-card">
            <EChartsWrapper option={categoryOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} className="dashboard-charts">
        <Col xs={24} md={8}>
          <Card title="订单状态分布" className="chart-card">
            <EChartsWrapper option={statusOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="退款/售后趋势" className="chart-card">
            <EChartsWrapper option={refundOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="收入/支出对比" className="chart-card">
            <EChartsWrapper option={incomeExpenseOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
