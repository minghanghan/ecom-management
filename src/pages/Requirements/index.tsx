import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Modal, Form, Input, Select, message, Space, Popconfirm, Empty, Typography } from 'antd';
import { PlusOutlined, MinusCircleOutlined, LinkOutlined, EditOutlined, AlertOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../../context/AythContext';
import { getRequirements, createRequirement, updateRequirement, deleteRequirement, type Requirement, type RequirementFormData, type PaginatedResult } from '../../api/requirements';
import './style.css';

const { TextArea } = Input;
const { Text } = Typography;

const priorityConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  low: { color: '#94a3b8', icon: <AlertOutlined />, label: '低' },
  medium: { color: '#3b82f6', icon: <AlertOutlined />, label: '中' },
  high: { color: '#f59e0b', icon: <AlertOutlined />, label: '高' },
  urgent: { color: '#ef4444', icon: <AlertOutlined />, label: '紧急' },
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: '#f59e0b', icon: <ClockCircleOutlined />, label: '待处理' },
  in_progress: { color: '#3b82f6', icon: <EditOutlined />, label: '处理中' },
  completed: { color: '#10b981', icon: <CheckCircleOutlined />, label: '已完成' },
};

export default function RequirementsPage() {
  const { user, stores } = useAuth();
  const [data, setData] = useState<PaginatedResult<Requirement>>({ items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<RequirementFormData>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRequirements({ page, pageSize: 10, status: statusFilter });
      setData(result);
    } catch {
      message.error('加载需求列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Requirement) => {
    setEditingId(record.id);
    form.setFieldsValue({
      product_name: record.product_name,
      product_sku: record.product_sku,
      links: record.links?.length ? record.links : [],
      description: record.description || '',
      priority: record.priority,
      store_id: record.store_id,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: RequirementFormData = {
        product_name: values.product_name,
        product_sku: values.product_sku,
        links: values.links?.filter(Boolean) || [],
        description: values.description || undefined,
        priority: values.priority || 'medium',
        store_id: values.store_id || null,
      };

      if (editingId) {
        await updateRequirement(editingId, payload);
        message.success('需求已更新');
      } else {
        await createRequirement(payload);
        message.success('需求已提交');
      }
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch {
      // validation error or API error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRequirement(id);
      message.success('已删除');
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const canEdit = (record: Requirement) => {
    if (record.status !== 'pending') return false;
    if (user?.role === 'admin') return true;
    return record.created_by === user?.userId;
  };

  const columns: ColumnsType<Requirement> = [
    {
      title: '商品名称',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 180,
      render: (name: string, record) => (
        <div className="req-product-cell">
          <div className="req-product-name">{name}</div>
          <div className="req-product-sku">{record.product_sku}</div>
        </div>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (p: string) => {
        const cfg = priorityConfig[p] || priorityConfig.medium;
        return <Tag color={cfg.color} className="req-priority-tag">{cfg.label}</Tag>;
      },
    },
    {
      title: '对标链接',
      dataIndex: 'links',
      key: 'links',
      width: 180,
      render: (links: string[]) => {
        if (!links || links.length === 0) {
          return <Text type="secondary" style={{ fontSize: 12 }}>无</Text>;
        }
        return (
          <div className="req-links-cell">
            {links.map((link, i) => (
              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="req-link-item">
                <LinkOutlined /> 链接{i + 1}
              </a>
            ))}
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const cfg = statusConfig[s] || statusConfig.pending;
        return (
          <Tag icon={cfg.icon} color={cfg.color} className="req-status-tag">
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '美工师',
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 100,
      render: (name: string | null) => (
        <span style={{ color: name ? '#3b82f6' : '#94a3b8', fontSize: 13 }}>
          {name || '暂无'}
        </span>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => (
        <span className="req-time-text">{t ? t.replace('T', ' ').slice(0, 16) : '—'}</span>
      ),
    },
    {
      title: '所属店铺',
      dataIndex: 'store_name',
      key: 'store_name',
      width: 110,
      render: (name: string | null) => (
        <span style={{ color: name ? '#1e293b' : '#94a3b8', fontSize: 13 }}>
          {name || '未指定'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} className="req-actions">
          {canEdit(record) && (
            <>
              <Button type="link" size="small" onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Popconfirm title="确定删除该需求？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
                <Button type="link" size="small" danger>删除</Button>
              </Popconfirm>
            </>
          )}
          {!canEdit(record) && record.status === 'in_progress' && (
            <Button type="link" size="small" onClick={() => handleEdit(record)} disabled>
              处理中
            </Button>
          )}
          {!canEdit(record) && record.status !== 'in_progress' && (
            <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
          )}
        </Space>
      ),
    },
  ];

  const statusTabs = [
    { key: '', label: '全部', color: '#3b82f6' },
    { key: 'pending', label: '待处理', color: '#f59e0b' },
    { key: 'in_progress', label: '处理中', color: '#3b82f6' },
    { key: 'completed', label: '已完成', color: '#10b981' },
  ];

  return (
    <div className="requirements-page">
      <div className="requirements-bg" />
      <div className="requirements-inner">
        {/* Header */}
        <div className="r-header">
          <div>
            <h1 className="r-title">需求提交</h1>
            <p className="r-subtitle">
              向美工师提交设计需求 ·{' '}
              <span className="r-subtitle-strong">待处理: {data.items.filter(i => i.status === 'pending').length}</span>
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} className="r-btn-add" onClick={handleCreate}>
            提交需求
          </Button>
        </div>

        {/* Status filter tabs */}
        <div className="r-status-tabs">
          {statusTabs.map((tab) => (
            <div
              key={tab.key}
              className={`r-status-tab ${statusFilter === tab.key ? 'r-status-tab-active' : ''}`}
              onClick={() => { setStatusFilter(tab.key || undefined); setPage(1); }}
            >
              <span className="r-status-tab-dot" style={{ background: tab.color }} />
              {tab.label}
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="r-table-card">
          <Table<Requirement>
            columns={columns}
            dataSource={data.items}
            rowKey="id"
            loading={loading}
            pagination={{
              current: data.pagination.page,
              pageSize: data.pagination.pageSize,
              total: data.pagination.total,
              onChange: (p) => setPage(p),
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            locale={{ emptyText: <Empty description="暂无需求" /> }}
            scroll={{ x: 1000 }}
          />
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        title={editingId ? '编辑需求' : '提交需求'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        confirmLoading={submitting}
        okText={editingId ? '保存' : '提交'}
        cancelText="取消"
        width={640}
        className="r-modal"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ links: [], priority: 'medium', store_id: undefined }}
        >
          <div className="r-form-grid">
            <Form.Item
              name="product_name"
              label="商品名称"
              rules={[{ required: true, message: '请输入商品名称' }]}
            >
              <Input placeholder="请输入商品名称" />
            </Form.Item>
            <Form.Item
              name="product_sku"
              label="商品编号"
              rules={[{ required: true, message: '请输入商品编号' }]}
            >
              <Input placeholder="请输入商品编号（SKU）" />
            </Form.Item>
          </div>

          <Form.Item
            name="priority"
            label="优先级"
          >
            <Select>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="store_id" label="所属店铺">
            <Select placeholder="选择店铺" allowClear>
              {stores.map((s) => (
                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.List name="links">
            {(fields, { add, remove }) => (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="r-form-section-label">对标链接</span>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add('')}>
                    添加链接
                  </Button>
                </div>
                {fields.length === 0 && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    暂无链接（可选）
                  </Text>
                )}
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={[name]} rules={[{ type: 'url', message: '请输入有效URL' }]}>
                      <Input placeholder="https://..." style={{ width: 460 }} prefix={<LinkOutlined />} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#94a3b8', cursor: 'pointer' }} />
                  </Space>
                ))}
              </>
            )}
          </Form.List>

          <Form.Item
            name="description"
            label="需求描述"
            rules={[{ required: true, message: '请描述需求内容' }]}
          >
            <TextArea rows={4} placeholder="请详细描述设计需求，包括风格要求、尺寸要求、参考元素等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
