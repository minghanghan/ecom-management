import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Form, Input, InputNumber, Select, Button, Table, Modal, Space, Image, message } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AythContext';
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  batchAction,
} from '../../api/products';
import type { Product } from '../../api/products';
import './style.css';

/* ─── Constants ─────────────────────────────────────────── */

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];

const DEFAULT_CATEGORIES = ['服装', '鞋帽', '配饰', '家居', '数码', '美妆', '食品', '图书'];

const STATUS_LABELS: Record<string, string> = {
  online: '上架',
  offline: '下架',
};

/* ─── Main Component ────────────────────────────────────── */

export default function ProductsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [form] = Form.useForm();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const can = (perm: string) => user?.role === 'admin' || user?.permissions?.[perm];
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])];

  /* ─── Data Loading ─────────────────── */

  const loadProducts = async (p = 1, ps?: number, sf?: string, so?: string) => {
    setLoading(true);
    const size = ps ?? pageSize;
    try {
      const res = await getProducts({
        page: p,
        pageSize: size,
        search,
        category: categoryFilter,
        status: statusFilter,
        sortField: sf ?? sortField,
        sortOrder: so ?? sortOrder,
      });
      setProducts(res.products);
      setTotal(res.pagination.total);
      setPage(res.pagination.page);
    } catch {
      message.error('加载商品列表失败');
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      setCategories(await getCategories());
    } catch {
      /* silently fail — categories are optional */
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  /* ─── Override antd sort icon gap (CSS-in-JS beats stylesheet) ── */
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .p-table-card .ant-table-column-sorters {
        justify-content: flex-start !important;
        gap: 7px !important;
      }
      .p-table-card .ant-table-column-title {
        flex: none !important;
      }
      .p-table-card .ant-table-column-sorter {
        margin-inline-start: 0 !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  /* ─── Sync file list when editing product changes ── */
  useEffect(() => {
    if (editingProduct?.images?.length) {
      setFileList(
        editingProduct.images.map((url: string, i: number) => ({
          uid: `-${i}`,
          name: url.split('/').pop() || `image-${i}`,
          status: 'done',
          url,
        }))
      );
    } else {
      setFileList([]);
    }
  }, [editingProduct]);

  /* ─── Handlers ─────────────────────── */

  const handleSearch = () => {
    setPage(1);
    loadProducts(1);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要永久删除该商品吗？删除后不可恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteProduct(id);
          message.success('删除成功');
          setSelectedRowKeys((prev) => prev.filter((k) => k !== id));
          loadProducts();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleBatchAction = async (action: 'online' | 'offline' | 'delete') => {
    const ids = selectedRowKeys;
    if (!ids.length) return;

    if (action === 'delete') {
      Modal.confirm({
        title: '确认批量删除',
        content: `确定要删除选中的 ${ids.length} 个商品吗？`,
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        centered: true,
        onOk: async () => {
          try {
            await batchAction({ ids, action });
            message.success(`已删除 ${ids.length} 个商品`);
            setSelectedRowKeys([]);
            loadProducts();
          } catch {
            message.error('操作失败');
          }
        },
      });
      return;
    }

    try {
      await batchAction({ ids, action });
      const label = action === 'online' ? '上架' : '下架';
      message.success(`已${label} ${ids.length} 个商品`);
      setSelectedRowKeys([]);
      loadProducts();
    } catch {
      message.error('操作失败');
    }
  };

  /* ─── Upload Handler ──────────────── */

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of files) formData.append('files', f);
      const { data } = await (await import('../../api/index')).default.post('/upload', formData);
      const newFiles = data.urls.map((url: string, i: number) => ({
        uid: `-${Date.now()}-${i}`,
        name: url.split('/').pop(),
        status: 'done' as const,
        url,
      }));
      const updated = [...fileList, ...newFiles];
      setFileList(updated);
      form.setFieldsValue({ images: updated.map((f) => f.url) });
    } catch {
      message.error('上传失败');
    }
    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ─── Form Submit ──────────────────── */

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const images = form.getFieldValue('images') || [];
      const submitData = { ...values, images };
      if (editingProduct) {
        await updateProduct(editingProduct.id, submitData);
        message.success('更新成功');
      } else {
        await createProduct(submitData);
        message.success('添加成功');
      }
      setModalOpen(false);
      setEditingProduct(null);
      loadProducts();
    } catch (err: any) {
      // validation errors are handled by antd form
      if (err?.errorFields) return;
      message.error('操作失败');
    }
    setSubmitting(false);
  };

  /* ─── Table Columns ────────────────── */

  const columns = [
    {
      title: '商品',
      key: 'product',
      render: (_: any, record: Product) => (
        <div className="product-cell">
          <Image
            className="product-thumb"
            src={record.images?.[0] || '/placeholder.svg'}
            alt={record.name}
            fallback="/placeholder.svg"
            preview={{ mask: '预览' }}
          />
          <div className="product-info">
            <div className="product-name">{record.name}</div>
            <div className="product-sku">SKU: {record.sku}</div>
          </div>
        </div>
      ),
    },
    {
      title: '类目',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      sorter: true,
      render: (v: string | null) =>
        v ? (
          <span className="p-category-tag">{v}</span>
        ) : (
          <span style={{ color: '#cbd5e1' }}>—</span>
        ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 130,
      sorter: true,
      render: (v: number) => <span className="price-value">¥{v.toFixed(2)}</span>,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      sorter: true,
      render: (v: number) => {
        const level = v <= 5 ? 'low' : v <= 20 ? 'medium' : 'high';
        return (
          <span className="stock-cell">
            <span className={`stock-dot stock-dot-${level}`} />
            <span className={`stock-text stock-text-${level}`}>{v}</span>
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: true,
      render: (v: string) => <span className={`status-badge status-badge-${v}`}>{STATUS_LABELS[v] || v}</span>,
    },
    {
      title: '时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      sorter: true,
      render: (v: string) => (
        <span className="time-text">
          {v ? v.slice(0, 10).replace(/-/g, '/') : '—'}
        </span>
      ),
    },
    ...(can('product_edit') || can('product_delete')
      ? [
          {
            title: '操作',
            key: 'action',
            width: 160,
            render: (_: any, record: Product) => (
              <Space size={4}>
                {can('product_edit') && (
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                  >
                    编辑
                  </Button>
                )}
                {can('product_delete') && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(record.id)}
                  >
                    删除
                  </Button>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  /* ─── Render ───────────────────────── */

  return (
    <div className="products-page">
      <div className="products-bg" />
      <div className="products-inner">
        {/* ─── Header ──────────── */}
        <header className="p-header">
          <div>
            <h1 className="p-title">商品管理</h1>
            <p className="p-subtitle">共 <span className="p-subtitle-strong">{total}</span> 个商品</p>
          </div>
          {can('product_create') && (
            <Button type="primary" icon={<PlusOutlined />} className="p-add-btn" onClick={openAddModal}>
              添加商品
            </Button>
          )}
        </header>

        {/* ─── Filters ─────────── */}
        <div className="p-filters-card">
          <div className="p-filters">
            <Input
              className="p-search-input"
              placeholder="搜索名称或编号"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              onClear={() => {
                setSearch('');
                setTimeout(() => loadProducts(1), 0);
              }}
            />
            <Select
              className="p-filter-select"
              placeholder="全部类目"
              value={categoryFilter}
              onChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
                loadProducts(1);
              }}
              allowClear
              onClear={() => {
                setCategoryFilter(undefined);
                setTimeout(() => loadProducts(1), 0);
              }}
            >
              {allCategories.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
            <Select
              className="p-filter-select"
              placeholder="全部状态"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
                loadProducts(1);
              }}
              allowClear
              onClear={() => {
                setStatusFilter(undefined);
                setTimeout(() => loadProducts(1), 0);
              }}
            >
              <Select.Option value="online">上架</Select.Option>
              <Select.Option value="offline">下架</Select.Option>
            </Select>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </div>
        </div>

        {/* ─── Batch Actions ────── */}
        {selectedRowKeys.length > 0 && (
          <div className="p-batch-bar">
            <span className="p-batch-count">已选 {selectedRowKeys.length} 项</span>
            <Space size={8}>
              <Button size="small" onClick={() => handleBatchAction('online')}>
                批量上架
              </Button>
              <Button size="small" onClick={() => handleBatchAction('offline')}>
                批量下架
              </Button>
              <Button size="small" danger onClick={() => handleBatchAction('delete')}>
                批量删除
              </Button>
            </Space>
          </div>
        )}

        {/* ─── Table ───────────── */}
        <div className="p-table-card">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={products}
            loading={loading}
            tableLayout="fixed"
            onChange={(_pagination, _filters, sorter, extra) => {
              if (extra.action !== 'sort') return;
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const field = s.field as string;
              const order = s.order === 'ascend' ? 'asc' : s.order === 'descend' ? 'desc' : '';
              if (field && order) {
                setSortField(field);
                setSortOrder(order);
                setPage(1);
                loadProducts(1, pageSize, field, order);
              } else {
                setSortField('id');
                setSortOrder('asc');
                setPage(1);
                loadProducts(1, pageSize, 'id', 'asc');
              }
            }}
            rowSelection={
              can('product_edit') || can('product_delete')
                ? {
                    type: 'checkbox',
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }
                : undefined
            }
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 30, 50],
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                if (ps !== pageSize) {
                  setPageSize(ps);
                  setPage(1);
                  loadProducts(1, ps, sortField, sortOrder);
                } else {
                  loadProducts(p, ps, sortField, sortOrder);
                }
              },
            }}
            scroll={{ x: true }}
          />
        </div>
      </div>

      {/* ─── Add / Edit Modal ───── */}
      <Modal
        title={editingProduct ? '编辑商品' : '添加商品'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={680}
        className="p-modal"
        okText={editingProduct ? '保存' : '添加'}
        cancelText="取消"
        destroyOnHidden
        centered
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={editingProduct || { category: '服装', stock: 10000, sizes: [], colors: [], images: [] }}
        >
          <div className="p-form-grid">
            <Form.Item
              name="name"
              label="商品名称"
              rules={[{ required: true, message: '请输入商品名称' }]}
            >
              <Input placeholder="输入商品名称" />
            </Form.Item>

            <Form.Item
              name="sku"
              label="商品编号"
              rules={[{ required: true, message: '请输入商品编号' }]}
            >
              <Input placeholder="输入唯一编号" />
            </Form.Item>

            <Form.Item name="category" label="类目">
              <Select
                placeholder="选择类目"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children as unknown as string)
                    ?.toLowerCase()
                    .includes(input.toLowerCase()) ?? false
                }
              >
                {allCategories.map((c) => (
                  <Select.Option key={c} value={c}>
                    {c}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="price"
              label="价格"
              rules={[
                { required: true, message: '请输入价格' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const cost = getFieldValue('cost_price');
                    if (cost && value && value < cost) {
                      return Promise.reject(new Error('价格不能低于成本价'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="0.00"
                formatter={(value) =>
                  `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                }
                parser={(value) => value?.replace(/[^\d.]/g, '') as any}
              />
            </Form.Item>

            <Form.Item
              name="cost_price"
              label="成本价"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const price = getFieldValue('price');
                    if (value && price && price < value) {
                      return Promise.reject(new Error('成本价不能高于价格'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="0.00"
                formatter={(value) =>
                  `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                }
                parser={(value) => value?.replace(/[^\d.]/g, '') as any}
              />
            </Form.Item>

            <Form.Item
              name="stock"
              label="库存"
              rules={[{ required: true, message: '请输入库存数量' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={0}
                placeholder="0"
              />
            </Form.Item>

            <Form.Item name="sizes" label="尺码">
              <Select
                mode="multiple"
                placeholder="选择尺码"
                options={SIZE_OPTIONS.map((s) => ({ label: s, value: s }))}
                maxTagCount={4}
              />
            </Form.Item>

            <Form.Item name="colors" label="颜色" rules={[{ required: true, message: '请至少输入一个颜色' }]}>
              <Select
                mode="tags"
                placeholder="输入颜色，回车添加"
                tokenSeparators={[',', '，']}
                maxTagCount={4}
              />
            </Form.Item>
          </div>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="输入商品描述" />
          </Form.Item>

          <div className="p-form-section-label">图片</div>
          <div className="p-image-picker">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
              multiple
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            {fileList.map((f) => (
              <div key={f.uid} className="p-image-thumb">
                <img src={f.url} alt={f.name} />
                <span className="p-image-remove" onClick={() => {
                  setFileList((prev) => prev.filter((x) => x.uid !== f.uid));
                  form.setFieldsValue({ images: fileList.filter((x) => x.uid !== f.uid).map((x) => x.url) });
                }}>&times;</span>
              </div>
            ))}
            {fileList.length < 5 && (
              <div className="p-image-add" onClick={() => fileInputRef.current?.click()}>
                {uploading ? <LoadingOutlined style={{ fontSize: 20 }} /> : <PlusOutlined style={{ fontSize: 20 }} />}
                <div style={{ marginTop: 4 }}>{uploading ? '上传中' : '上传图片'}</div>
              </div>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
