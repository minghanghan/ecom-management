import { useEffect, useState, useRef } from 'react';
import {
  ShoppingOutlined,
  ShoppingCartOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import EChartsWrapper from '../../components/EChartsWrapper';
import { useAuth } from '../../context/AythContext';
import { getDashboardSummary, getDashboardCharts } from '../../api/dashboard';
import type { DashboardSummary, ChartData } from '../../api/dashboard';
import './style.css';

/* ─── Constants ─────────────────────────────────────────── */

const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#64748b',
  refunded: '#f43f5e',
};

/* Light chart axis defaults (login page blue theme) */
const LIGHT_AXIS = {
  axisLine: { lineStyle: { color: '#e2e8f0' } },
  axisTick: { lineStyle: { color: '#e2e8f0' } },
  axisLabel: { color: '#64748b', fontSize: 11, fontFamily: 'DM Sans, system-ui, sans-serif' },
  splitLine: { lineStyle: { color: '#f1f5f9' } },
};

const LIGHT_TOOLTIP = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  textStyle: { color: '#1e293b', fontSize: 12, fontFamily: 'DM Sans, system-ui, sans-serif' },
};

/* ─── Animated Counter Hook ─────────────────────────────── */

function useAnimatedNumber(target: number, precision = 0) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = 0;
    if (target === 0) {
      setDisplay(0);
      return;
    }
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  if (precision > 0) return display.toFixed(precision);
  return Math.round(display).toLocaleString();
}

/* ─── Stat Card ─────────────────────────────────────────── */

const STAT_CARDS = [
  {
    key: 'totalProducts',
    label: '商品总数',
    icon: <ShoppingOutlined />,
    suffix: '',
    className: 'd-stat-card-0',
    iconClass: 'd-stat-icon-0',
  },
  {
    key: 'monthlyOrders',
    label: '本月订单',
    icon: <ShoppingCartOutlined />,
    suffix: '',
    className: 'd-stat-card-1',
    iconClass: 'd-stat-icon-1',
  },
  {
    key: 'monthlyRefunds',
    label: '本月售后',
    icon: <ExclamationCircleOutlined />,
    suffix: '单',
    className: 'd-stat-card-2',
    iconClass: 'd-stat-icon-2',
  },
  {
    key: 'monthlyIncome',
    label: '本月收入',
    icon: <DollarOutlined />,
    suffix: '',
    className: 'd-stat-card-3',
    iconClass: 'd-stat-icon-3',
    precision: 2,
    prefix: '¥',
  },
] as const;

function StatCard({
  card,
  value,
  delay,
}: {
  card: (typeof STAT_CARDS)[number];
  value: number;
  delay: number;
}) {
  const animated = useAnimatedNumber(
    value,
    'precision' in card ? (card as any).precision : 0,
  );
  const prefix = 'prefix' in card ? (card as any).prefix : '';
  const precision = 'precision' in card ? (card as any).precision : 0;

  return (
    <div className={`d-stat-card ${card.className}`} style={{ animationDelay: `${delay}s` }}>
      <span className={`d-stat-icon ${card.iconClass}`}>{card.icon}</span>
      <div className="d-stat-number">
        {prefix}
        {animated}
        {card.suffix}
      </div>
      <div className="d-stat-label">{card.label}</div>
    </div>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="dashboard">
      <div className="dashboard-bg" />
      <div className="dashboard-inner">
        <div className="d-skeleton-header" />
        <div className="d-skeleton-stats">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="d-skeleton-card" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <div className="d-skeleton-charts">
          <div className="d-skeleton-chart" style={{ animationDelay: '0.4s' }} />
          <div className="d-skeleton-chart" style={{ animationDelay: '0.45s' }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */

function fmtDate(iso: string) {
  const d = iso.split('T')[0]; // "2026-04-21"
  return d.slice(5); // "04-21"
}

/* ─── Main Component ────────────────────────────────────── */

export default function DashboardPage() {
  const { user, selectedStoreId } = useAuth();
  if (user && user.role !== 'admin' && !user.permissions?.dashboard_view) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>无权限访问仪表盘</div>;
  }
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getDashboardSummary(selectedStoreId), getDashboardCharts(selectedStoreId)])
      .then(([s, c]) => {
        setSummary(s);
        setCharts(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  /* ── Chart Options ─────────────────────────────────── */

  const orderTrendOption = {
    tooltip: { ...LIGHT_TOOLTIP, trigger: 'axis' as const },
    grid: { top: 16, right: 14, bottom: 28, left: 42 },
    xAxis: {
      type: 'category' as const,
      data: charts?.orderTrend.map((d) => fmtDate(d.date)) || [],
      ...LIGHT_AXIS,
      axisLabel: { ...LIGHT_AXIS.axisLabel, interval: 3, rotate: 0 },
    },
    yAxis: { type: 'value' as const, minInterval: 1, ...LIGHT_AXIS },
    series: [
      {
        name: '订单数',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: charts?.orderTrend.map((d) => d.count) || [],
        lineStyle: { color: '#3b82f6', width: 2.5 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.12)' },
              { offset: 1, color: 'rgba(59,130,246,0)' },
            ],
          },
        },
        animationDelay: (idx: number) => idx * 25,
      },
    ],
    animationEasing: 'cubicOut',
  };

  const PLATFORM_LABELS: Record<string, string> = {
    pdd: '拼多多', taobao: '淘宝', jd: '京东', douyin: '抖音', weixin: '微信', other: '其他',
  };

  const platformOption = {
    tooltip: { ...LIGHT_TOOLTIP, trigger: 'axis' as const },
    grid: { top: 16, right: 14, bottom: 22, left: 42 },
    xAxis: {
      type: 'category' as const,
      data: charts?.platformDist.map((d) => PLATFORM_LABELS[d.platform] || d.platform) || [],
      ...LIGHT_AXIS,
      axisLabel: { ...LIGHT_AXIS.axisLabel, fontSize: 10, interval: 0, rotate: 0 },
    },
    yAxis: { type: 'value' as const, minInterval: 1, ...LIGHT_AXIS },
    series: [
      {
        type: 'bar',
        barWidth: 24,
        data: charts?.platformDist.map((d) => ({
          value: d.count,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#1d4ed8' },
              ],
            },
            borderRadius: [3, 3, 0, 0],
          },
        })) || [],
        animationDelay: (idx: number) => idx * 60,
      },
    ],
    animationEasing: 'cubicOut',
  };

  const platformSalesOption = {
    tooltip: { ...LIGHT_TOOLTIP, trigger: 'axis' as const },
    grid: { top: 16, right: 14, bottom: 22, left: 48 },
    xAxis: {
      type: 'category' as const,
      data: charts?.platformDist.map((d) => PLATFORM_LABELS[d.platform] || d.platform) || [],
      ...LIGHT_AXIS,
      axisLabel: { ...LIGHT_AXIS.axisLabel, fontSize: 10, interval: 0, rotate: 0 },
    },
    yAxis: { type: 'value' as const, ...LIGHT_AXIS, axisLabel: { ...LIGHT_AXIS.axisLabel, formatter: '¥{value}' } },
    series: [
      {
        type: 'bar',
        barWidth: 24,
        data: charts?.platformDist.map((d) => ({
          value: d.amount,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#10b981' },
                { offset: 1, color: '#065f46' },
              ],
            },
            borderRadius: [3, 3, 0, 0],
          },
        })) || [],
        animationDelay: (idx: number) => idx * 60,
      },
    ],
    animationEasing: 'cubicOut',
  };

  const statusOption = {
    tooltip: {
      ...LIGHT_TOOLTIP,
      trigger: 'item' as const,
      formatter: '{b}: {c}单 ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 4, borderColor: '#ffffff', borderWidth: 2 },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 10.5,
          color: '#64748b',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          lineHeight: 16,
        },
        labelLine: { length: 8, length2: 6, lineStyle: { color: '#cbd5e1' } },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
        },
        data: charts?.statusDist.map((d) => ({
          name: STATUS_MAP[d.status] || d.status,
          value: d.count,
          itemStyle: { color: STATUS_COLORS[d.status] || '#64748b' },
        })) || [],
        animationDelay: (idx: number) => idx * 100,
      },
    ],
    animationEasing: 'cubicOut',
  };

  if (loading) return <DashboardSkeleton />;

  const roleLabel =
    user?.role_name ||
    { admin: '系统管理员', manager: '运营管理', artist: '美工师', user: '普通用户' }[
      user?.role || ''
    ] || '';

  return (
    <div className="dashboard">
      {/* Background layer */}
      <div className="dashboard-bg" />

      {/* Content */}
      <div className="dashboard-inner">
        {/* ─── Header ─────────── */}
        <header className="d-header">
          <div className="d-header-left">
            <h1 className="d-title">欢迎回来，{user?.nickname || user?.username}</h1>
            <p className="d-subtitle">
              {roleLabel}
              <span className="d-subtitle-dot">·</span>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          </div>
          <div className="d-header-badge">
            <span className="d-badge-dot" />
            系统运行正常
          </div>
        </header>

        {/* ─── Stats ──────────── */}
        <div className="d-stats">
          {STAT_CARDS.map((card, i) => (
            <StatCard key={card.key} card={card} value={summary?.[card.key as keyof DashboardSummary] as number || 0} delay={0.08 + i * 0.06} />
          ))}
        </div>

        {/* ─── Charts Row 1 ───── */}
        <div className="d-charts-row d-charts-row-2col">
          <div className="d-chart-card" style={{ animationDelay: '0.3s' }}>
            <div className="d-chart-header">
              <span className="d-chart-title">近30天订单趋势</span>
              {charts?.orderTrend && (
                <span className="d-chart-meta">
                  合计 {charts.orderTrend.reduce((s, d) => s + d.count, 0)} 单
                </span>
              )}
            </div>
            <EChartsWrapper option={orderTrendOption} style={{ height: 290 }} />
          </div>

          <div className="d-chart-card" style={{ animationDelay: '0.34s' }}>
            <div className="d-chart-header">
              <span className="d-chart-title">平台分布</span>
            </div>
            <EChartsWrapper option={platformOption} style={{ height: 290 }} />
          </div>
        </div>

        {/* ─── Charts Row 2 ───── */}
        <div className="d-charts-row d-charts-row-2col">
          <div className="d-chart-card" style={{ animationDelay: '0.38s' }}>
            <div className="d-chart-header">
              <span className="d-chart-title">订单状态分布</span>
            </div>
            <EChartsWrapper option={statusOption} style={{ height: 290 }} />
          </div>
          <div className="d-chart-card" style={{ animationDelay: '0.42s' }}>
            <div className="d-chart-header">
              <span className="d-chart-title">平台销售额分布</span>
              {charts?.platformDist && (
                <span className="d-chart-meta">
                  合计 ¥{charts.platformDist
                    .reduce((s, d) => s + d.amount, 0)
                    .toLocaleString()}
                </span>
              )}
            </div>
            <EChartsWrapper option={platformSalesOption} style={{ height: 290 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
