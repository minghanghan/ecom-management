import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Form, Input, InputNumber, Select, Button, Table, Modal, Space, Image, message, DatePicker, Tag, Tooltip, Popconfirm,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, CloudUploadOutlined, ExportOutlined, EyeOutlined,
  DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  RollbackOutlined, CopyOutlined, FilterOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AythContext';
import {
  getOrders, getOrder, createOrder, updateOrder, deleteOrder, batchDeleteOrders,
  transitionOrderStatus, setRefundStatus, importOrders, exportOrders,
} from '../../api/orders';
import type { Order, OrderFormData } from '../../api/orders';
import './style.css';

/* ─── Constants ─────────────────────────────────────── */

const PLATFORMS = ['pdd', 'taobao', 'jd', 'douyin', 'weixin', 'other'];

const PLATFORM_LABELS: Record<string, string> = {
  pdd: '拼多多', taobao: '淘宝', jd: '京东',
  douyin: '抖音', weixin: '微信', other: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', paid: '已付款', shipped: '已发货',
  delivered: '已送达', completed: '已完成', cancelled: '已取消',
};

const REFUND_LABELS: Record<string, string> = {
  none: '无', refunding: '退款中', refunded: '已退款', exchanged: '已换货',
};

// ─── Order status flow chart ───────────────────────────
// pending → paid → shipped → delivered → completed
// All states except completed/cancelled → refunding → refunded

const STATUS_TRANSITIONS: Record<string, { next: string; label: string; icon: any; color: string }[]> = {
  pending: [
    { next: 'paid', label: '标记已付款', icon: <CheckCircleOutlined />, color: '#10b981' },
    { next: 'cancelled', label: '取消订单', icon: <CloseCircleOutlined />, color: '#ef4444' },
  ],
  paid: [
    { next: 'shipped', label: '标记已发货', icon: <SyncOutlined />, color: '#3b82f6' },
    { next: 'cancelled', label: '取消订单', icon: <CloseCircleOutlined />, color: '#ef4444' },
  ],
  shipped: [
    { next: 'delivered', label: '标记已送达', icon: <CheckCircleOutlined />, color: '#10b981' },
  ],
  delivered: [
    { next: 'completed', label: '标记已完成', icon: <CheckCircleOutlined />, color: '#10b981' },
  ],
};

const REFUND_ACTIONS = [
  { value: 'refunding', label: '标记退款中', color: '#f97316' },
  { value: 'refunded', label: '确认已退款', color: '#ef4444' },
  { value: 'exchanged', label: '确认已换货', color: '#8b5cf6' },
  { value: 'none', label: '撤销售后', color: '#64748b' },
];

/* ─── Main Component ────────────────────────────────── */

export default function OrdersPage() {
  const { user, selectedStoreId } = useAuth();
  const location = useLocation();
  const [form] = Form.useForm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [sortField, setSortField] = useState('order_date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const can = (perm: string) => user?.role === 'admin' || user?.permissions?.[perm];
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  /* ─── Data Loading ─────────────────── */

  const loadOrders = async (p = 1, ps?: number, sf?: string, so?: string) => {
    setLoading(true);
    const size = ps ?? pageSize;
    try {
      const res = await getOrders({
        page: p,
        pageSize: size,
        search,
        platform: platformFilter,
        status: statusFilter,
        dateFrom: dateRange?.[0],
        dateTo: dateRange?.[1],
        sortField: sf ?? sortField,
        sortOrder: so ?? sortOrder,
        store_id: selectedStoreId,
      });
      setOrders(res.orders);
      setTotal(res.pagination.total);
      setPage(res.pagination.page);
      if (res.stats) setStats(res.stats);
    } catch {
      message.error('加载订单列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    setSelectedRowKeys([]);
    loadOrders(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, platformFilter, dateRange, sortField, sortOrder, page, pageSize, selectedStoreId, location.key]);

  const handleSearch = () => {
    setPage(1);
    loadOrders(1, pageSize);
  };

  /* ─── Detail ────────────────────────── */

  const openDetail = async (order: Order) => {
    try {
      const full = await getOrder(order.id);
      setDetailOrder(full);
      setDetailModalOpen(true);
    } catch {
      message.error('加载订单详情失败');
    }
  };

  /* ─── Status Transition ─────────────── */

  const handleStatusTransition = async (id: number, status: string) => {
    try {
      await transitionOrderStatus(id, status);
      message.success('状态更新成功');
      loadOrders(page, pageSize);
      if (detailOrder?.id === id) {
        const updated = await getOrder(id);
        setDetailOrder(updated);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || '操作失败');
    }
  };

  /* ─── Refund / After-sale ───────────── */

  const handleRefundAction = async (id: number, refundStatus: string) => {
    try {
      await setRefundStatus(id, refundStatus);
      message.success('售后状态已更新');
      loadOrders(page, pageSize);
      if (detailOrder?.id === id) {
        const updated = await getOrder(id);
        setDetailOrder(updated);
      }
    } catch {
      message.error('操作失败');
    }
  };

  /* ─── Import ─────────────────────────── */

  const handleImport = async () => {
    if (!importFile) {
      message.warning('请选择文件');
      return;
    }
    setImporting(true);
    try {
      const result = await importOrders(importFile);
      message.success(result.message);
      setImportModalOpen(false);
      setImportFile(null);
      loadOrders(1);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '导入失败');
    }
    setImporting(false);
  };

  /* ─── Export ─────────────────────────── */

  const handleExport = async () => {
    try {
      await exportOrders({
        platform: platformFilter,
        status: statusFilter,
        dateFrom: dateRange?.[0],
        dateTo: dateRange?.[1],
      });
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  /* ─── Create / Edit ─────────────────── */

  const openEditModal = (order?: Order) => {
    setEditingOrder(order || null);
    setEditModalOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (editingOrder) {
        await updateOrder(editingOrder.id, values);
        message.success('更新成功');
      } else {
        await createOrder(values);
        message.success('添加成功');
      }
      setEditModalOpen(false);
      setEditingOrder(null);
      loadOrders();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('操作失败');
    }
    setSubmitting(false);
  };

  /* ─── Delete ─────────────────────────── */

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该订单吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteOrder(id);
          message.success('删除成功');
          setSelectedRowKeys((prev) => prev.filter((k) => k !== id));
          loadOrders();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  /* ─── Batch Delete ──────────────────────── */

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条订单吗？`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const result = await batchDeleteOrders(selectedRowKeys);
          message.success(result.message);
          setSelectedRowKeys([]);
          loadOrders();
        } catch {
          message.error('批量删除失败');
        }
      },
    });
  };

  /* ─── Copy order number ──────────────── */

  const copyOrderNo = (no: string) => {
    navigator.clipboard.writeText(no).then(() => {
      message.success('已复制订单号');
    });
  };

  /* ─── Status Tags ────────────────────── */

  const STATUS_TAG_COLORS: Record<string, string> = {
    pending: 'orange', paid: 'blue', shipped: 'purple',
    delivered: 'cyan', completed: 'green', cancelled: 'default',
  };

  /* ─── Row Selection ──────────────────── */

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[]),
  };

  /* ─── Table Columns ──────────────────── */

  const columns: any[] = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
      sorter: true,
      render: (v: string) => (
        <span className="order-no-cell" onClick={() => copyOrderNo(v)} title="点击复制">
          <code className="order-no-text">{v}</code>
          <CopyOutlined className="order-no-copy" />
        </span>
      ),
    },
    {
      title: '商品',
      key: 'product',
      width: 200,
      render: (_: any, r: Order) => (
        <div className="order-product-cell">
          <div className="order-product-name">{r.product_name || '—'}</div>
          {r.product_specs && <div className="order-product-specs">{r.product_specs}</div>}
        </div>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 64,
      align: 'center' as const,
    },
    {
      title: '金额',
      key: 'amount',
      width: 140,
      sorter: true,
      render: (_: any, r: Order) => (
        <div className="order-amount-cell">
          <span className="order-amount">¥{Number(r.actual_amount || r.total_amount).toFixed(2)}</span>
          {r.discount > 0 && <span className="order-discount">-¥{Number(r.discount).toFixed(2)}</span>}
        </div>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 80,
      render: (v: string) => (
        <span className="order-platform-tag">{PLATFORM_LABELS[v] || v || '—'}</span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      sorter: true,
      render: (_: any, r: Order) => {
        const hasRefund = r.refund_status && r.refund_status !== 'none';
        return (
          <div className="order-status-group">
            <Tag color={STATUS_TAG_COLORS[r.status] || 'default'} className="order-status-tag">
              {STATUS_LABELS[r.status] || r.status}
            </Tag>
            {hasRefund && (
              <Tag color={r.refund_status === 'refunded' ? 'red' : r.refund_status === 'exchanged' ? 'purple' : 'orange'} className="order-refund-tag">
                {REFUND_LABELS[r.refund_status]}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '时间',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 110,
      sorter: true,
      render: (v: string) => (
        <span className="order-time-text">
          {v ? v.slice(0, 10).replace(/-/g, '/') : '—'}
        </span>
      ),
    },
    ...(can('order_view') || can('order_delete')
      ? [
          {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: any, r: Order) => (
              <Space size={4} className="order-actions">
                <Tooltip title="查看详情">
                  <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
                </Tooltip>
                {can('order_delete') && (
                  <Tooltip title="删除">
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  /* ─── Render ─────────────────────────── */

  return (
    <div className="orders-page">
      <div className="orders-bg" />
      <div className="orders-inner">
        {/* ─── Header ────────────── */}
        <header className="o-header">
          <div>
            <h1 className="o-title">订单管理</h1>
            <p className="o-subtitle">
              共 <span className="o-subtitle-strong">{total}</span> 个订单
              {stats.refunding > 0 && (
                <span className="o-refunding-badge"> · {stats.refunding} 笔退款中</span>
              )}
            </p>
          </div>
          <Space size={10}>
            {can('order_import') && (
              <Button icon={<CloudUploadOutlined />} className="o-btn-import" onClick={() => setImportModalOpen(true)}>
                导入订单
              </Button>
            )}
            {can('order_export') && (
              <Button icon={<ExportOutlined />} className="o-btn-export" onClick={handleExport}>
                批量导出
              </Button>
            )}
            {can('order_create') && (
              <Button type="primary" icon={<PlusOutlined />} className="o-btn-add" onClick={() => openEditModal()}>
                手动添加
              </Button>
            )}
          </Space>
        </header>

        {/* ─── Quick Stats ────────── */}
        <div className="o-stats-row">
          <div
            className={`o-stat-item${!statusFilter ? ' o-stat-item-active' : ''}`}
            onClick={() => { setStatusFilter(undefined); setPage(1); }}
          >
            <span className="o-stat-dot o-stat-dot-all" />
            <span className="o-stat-label">全部订单</span>
            <span className="o-stat-count">{Object.values(stats).reduce((a, b) => a + b, 0) || 0}</span>
          </div>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div
              key={key}
              className={`o-stat-item${statusFilter === key ? ' o-stat-item-active' : ''}`}
              onClick={() => {
                setStatusFilter(statusFilter === key ? undefined : key);
                setPage(1);
              }}
            >
              <span className={`o-stat-dot o-stat-dot-${key}`} />
              <span className="o-stat-label">{label}</span>
              <span className="o-stat-count">{stats[key] || 0}</span>
            </div>
          ))}
        </div>

        {/* ─── Filters ───────────── */}
        <div className="o-filters-card">
          <div className="o-filters">
            <Input
              className="o-search-input"
              placeholder="搜索订单号/商品/买家"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              onClear={() => { setSearch(''); }}
            />
            <Select
              className="o-filter-select"
              placeholder="全部平台"
              value={platformFilter}
              onChange={(v) => { setPlatformFilter(v); setPage(1); }}
              allowClear
              onClear={() => { setPlatformFilter(undefined); setPage(1); }}
            >
              {PLATFORMS.map((p) => (
                <Select.Option key={p} value={p}>{PLATFORM_LABELS[p] || p}</Select.Option>
              ))}
            </Select>
            <DatePicker.RangePicker
              className="o-date-picker"
              placeholder={['开始日期', '结束日期']}
              onChange={(_, dateStrings) => {
                setDateRange(dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : null);
                setPage(1);
              }}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            {(platformFilter || statusFilter || dateRange || search) && (
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setPlatformFilter(undefined);
                  setStatusFilter(undefined);
                  setDateRange(null);
                  setSearch('');
                  setPage(1);
                }}
              >
                清除筛选
              </Button>
            )}
          </div>
        </div>

        {/* ─── Batch Actions ──────────── */}
        {selectedRowKeys.length > 0 && (
          <div className="o-batch-bar">
            <span className="o-batch-info">已选择 <strong>{selectedRowKeys.length}</strong> 条订单</span>
            {can('order_delete') && (
              <Button danger icon={<DeleteOutlined />} className="o-btn-batch-delete" onClick={handleBatchDelete}>
                批量删除
              </Button>
            )}
          </div>
        )}

        {/* ─── Table ─────────────── */}
        <div className="o-table-card">
          <Table<Order>
            rowKey="id"
            rowSelection={rowSelection}
            columns={columns}
            dataSource={orders}
            loading={loading}
            tableLayout="fixed"
            onChange={(_pg, _fl, sorter, extra) => {
              if (extra.action !== 'sort') return;
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const field = s.field === 'amount' ? 'actual_amount' : (s.field as string);
              const order = s.order === 'ascend' ? 'asc' : s.order === 'descend' ? 'desc' : '';
              if (field && order) {
                setSortField(field);
                setSortOrder(order);
                setPage(1);
              } else {
                setSortField('order_date');
                setSortOrder('desc');
                setPage(1);
              }
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 30, 50],
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                if (ps !== pageSize) { setPageSize(ps); setPage(1); }
                else { setPage(p); }
              },
            }}
            scroll={{ x: 1000 }}
          />
        </div>
      </div>

      {/* ─── Detail Modal ────────── */}
      <Modal
        title={null}
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setDetailOrder(null); }}
        footer={null}
        width={720}
        className="o-detail-modal"
        destroyOnClose
        centered
      >
        {detailOrder && (
          <div className="o-detail">
            <div className="o-detail-header">
              <div className="o-detail-title-row">
                <h2 className="o-detail-title">订单详情</h2>
                <Tag color={STATUS_TAG_COLORS[detailOrder.status] || 'default'} className="order-status-tag">
                  {STATUS_LABELS[detailOrder.status] || detailOrder.status}
                </Tag>
              </div>
              <code className="o-detail-order-no" onClick={() => copyOrderNo(detailOrder.order_no)}>
                #{detailOrder.order_no} <CopyOutlined style={{ fontSize: 12, opacity: 0.5 }} />
              </code>
            </div>

            <div className="o-detail-grid">
              <div className="o-detail-section">
                <h3 className="o-detail-section-title">商品信息</h3>
                <div className="o-detail-field"><span className="o-detail-label">商品名称</span><span>{detailOrder.product_name || '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">规格</span><span>{detailOrder.product_specs || '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">数量</span><span>{detailOrder.quantity}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">单价</span><span className="o-detail-mono">¥{Number(detailOrder.unit_price).toFixed(2)}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">总金额</span><span className="o-detail-mono">¥{Number(detailOrder.total_amount).toFixed(2)}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">优惠</span><span className="o-detail-mono">-¥{Number(detailOrder.discount).toFixed(2)}</span></div>
                <div className="o-detail-field o-detail-field-total"><span className="o-detail-label">实付</span><span className="o-detail-mono o-detail-amount">¥{Number(detailOrder.actual_amount || detailOrder.total_amount).toFixed(2)}</span></div>
              </div>

              <div className="o-detail-section">
                <h3 className="o-detail-section-title">买家信息</h3>
                <div className="o-detail-field"><span className="o-detail-label">平台</span><span>{PLATFORM_LABELS[detailOrder.platform] || detailOrder.platform}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">买家</span><span>{detailOrder.buyer_name || '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">电话</span><span>{detailOrder.buyer_phone || '—'}</span></div>
                <div className="o-detail-field o-detail-field-address"><span className="o-detail-label">地址</span><span>{detailOrder.shipping_address || '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">物流</span><span>{detailOrder.shipping_method || '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">单号</span><span className="o-detail-mono">{detailOrder.tracking_no || '—'}</span></div>
              </div>

              <div className="o-detail-section">
                <h3 className="o-detail-section-title">时间线</h3>
                <div className="o-detail-field"><span className="o-detail-label">下单时间</span><span>{detailOrder.order_date ? new Date(detailOrder.order_date).toLocaleString('zh-CN') : '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">付款时间</span><span>{detailOrder.payment_date ? new Date(detailOrder.payment_date).toLocaleString('zh-CN') : '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">发货时间</span><span>{detailOrder.shipping_date ? new Date(detailOrder.shipping_date).toLocaleString('zh-CN') : '—'}</span></div>
                <div className="o-detail-field"><span className="o-detail-label">创建时间</span><span>{new Date(detailOrder.created_at).toLocaleString('zh-CN')}</span></div>
              </div>

              <div className="o-detail-section">
                <h3 className="o-detail-section-title">售后</h3>
                <div className="o-detail-field"><span className="o-detail-label">售后状态</span><span>
                  <Tag color={detailOrder.refund_status === 'none' ? 'default' : detailOrder.refund_status === 'refunded' ? 'red' : 'orange'}>
                    {REFUND_LABELS[detailOrder.refund_status] || detailOrder.refund_status}
                  </Tag>
                </span></div>
                <div className="o-detail-field o-detail-field-full"><span className="o-detail-label">卖家备注</span><span>{detailOrder.seller_remark || '—'}</span></div>
                <div className="o-detail-field o-detail-field-full"><span className="o-detail-label">买家备注</span><span className="o-detail-muted">{detailOrder.buyer_remark || '—'}</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Create / Edit Modal ──── */}
      <Modal
        title={editingOrder ? '编辑订单' : '手动添加订单'}
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingOrder(null); }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={700}
        className="o-modal"
        okText={editingOrder ? '保存' : '添加'}
        cancelText="取消"
        destroyOnClose
        centered
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={editingOrder || { platform: 'pdd', quantity: 1, status: 'pending' }}
        >
          <div className="o-form-grid">
            <Form.Item name="order_no" label="订单号">
              <Input placeholder="留空自动生成" />
            </Form.Item>
            <Form.Item name="platform" label="平台">
              <Select>
                {PLATFORMS.map((p) => (
                  <Select.Option key={p} value={p}>{PLATFORM_LABELS[p] || p}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="product_name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
              <Input placeholder="输入商品名称" />
            </Form.Item>
            <Form.Item name="product_specs" label="规格">
              <Input placeholder="如: 黑色 / XL" />
            </Form.Item>
            <Form.Item name="quantity" label="数量">
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="unit_price" label="单价">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
            </Form.Item>
            <Form.Item name="total_amount" label="总金额">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
            </Form.Item>
            <Form.Item name="discount" label="优惠">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
            </Form.Item>
            <Form.Item name="actual_amount" label="实付金额">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
            </Form.Item>
            <Form.Item name="order_date" label="下单时间">
              <Input placeholder="YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
          </div>

          <div className="o-form-section-label">买家信息</div>
          <div className="o-form-grid">
            <Form.Item name="buyer_name" label="买家姓名">
              <Input placeholder="买家姓名" />
            </Form.Item>
            <Form.Item name="buyer_phone" label="联系电话">
              <Input placeholder="手机号" />
            </Form.Item>
            <Form.Item name="shipping_address" label="收货地址">
              <Input placeholder="省/市/区/详细地址" />
            </Form.Item>
            <Form.Item name="shipping_method" label="物流方式">
              <Input placeholder="快递公司" />
            </Form.Item>
            <Form.Item name="tracking_no" label="物流单号">
              <Input placeholder="物流单号" />
            </Form.Item>
          </div>

          <Form.Item name="buyer_remark" label="买家备注">
            <Input.TextArea rows={2} placeholder="买家备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Import Modal ──────────── */}
      <Modal
        title="导入订单"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setImportFile(null); }}
        onOk={handleImport}
        confirmLoading={importing}
        okText="导入"
        cancelText="取消"
        className="o-modal"
        centered
        destroyOnClose
      >
        <div className="o-import-area">
          <div
            className={`o-import-dropzone${importFile ? ' o-import-dropzone-has' : ''}`}
            onClick={() => document.getElementById('o-import-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) setImportFile(file);
            }}
          >
            <input
              id="o-import-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) setImportFile(e.target.files[0]);
              }}
            />
            {importFile ? (
              <div className="o-import-file-info">
                <CloudUploadOutlined style={{ fontSize: 32, color: '#f59e0b' }} />
                <p className="o-import-file-name">{importFile.name}</p>
                <p className="o-import-file-size">{(importFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <CloudUploadOutlined style={{ fontSize: 40, color: '#94a3b8' }} />
                <p className="o-import-hint">点击或拖拽上传 Excel / CSV 文件</p>
                <p className="o-import-sub">支持拼多多导出的订单文件</p>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
