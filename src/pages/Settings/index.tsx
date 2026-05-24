import { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, message, Tabs, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AythContext';
import {
  getUsers, createUser, updateUser, deleteUser,
  getRoles, createRole, updateRole, deleteRole,
  getPermissionDefs,
  getStores, createStore, updateStore, deleteStore,
} from '../../api/admin';
import type { AdminUser, AdminRole, AdminStore, PermissionDef } from '../../api/admin';
import './style.css';

/* ─── Tab: User Management ──────────────────────── */

function UserTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r, s] = await Promise.all([getUsers(), getRoles(), getStores()]);
      setUsers(u);
      setRoles(r);
      setStores(s);
    } catch { message.error('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (user?: AdminUser) => {
    setEditing(user || null);
    setModalOpen(true);
    if (user) {
      setTimeout(() => form.setFieldsValue(user), 50);
    } else {
      form.resetFields();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (editing) {
        const updated = await updateUser(editing.id, values);
        setUsers((prev) => prev.map((u) => u.id === editing.id ? { ...u, ...updated } : u));
        message.success('更新成功');
      } else {
        const created = await createUser(values);
        setUsers((prev) => [...prev, created]);
        message.success('创建成功');
      }
      setModalOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('操作失败');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      message.success('删除成功');
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', width: 140 },
    { title: '昵称', dataIndex: 'nickname', width: 120, render: (v: string | null) => v || '—' },
    { title: '角色', dataIndex: 'role_name', width: 120, render: (_: any, r: AdminUser) => <Tag>{r.role_name || r.role}</Tag> },
    { title: '店铺', dataIndex: 'store_name', width: 120, render: (v: string | null) => v || '—' },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> },
    { title: '上次登录', dataIndex: 'last_login_at', width: 160, render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: AdminUser) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          {r.id !== currentUser?.id && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="s-tab-content">
      <div className="s-tab-header">
        <span className="s-tab-count">共 {users.length} 个用户</span>
        <Button type="primary" icon={<PlusOutlined />} className="s-btn-primary" onClick={() => openModal()}>
          添加用户
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1000 }}
        size="middle"
      />
      <Modal
        title={editing ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={editing ? '保存' : '添加'}
        cancelText="取消"
        destroyOnClose
        centered
        className="s-modal"
      >
        <Form form={form} layout="vertical" preserve={false}
          initialValues={{ role: 'user', status: 1 }}
        >
          <div className="s-form-grid">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="手机号或用户名" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={editing ? [] : [{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder={editing ? '留空不修改' : '输入密码'} />
            </Form.Item>
            <Form.Item name="nickname" label="昵称">
              <Input placeholder="显示名称" />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input placeholder="邮箱" />
            </Form.Item>
            <Form.Item name="role_id" label="角色">
              <Select placeholder="选择角色" allowClear>
                {roles.map((r) => (
                  <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="role" label="基础角色">
              <Select placeholder="选择基础角色">
                <Select.Option value="user">普通用户</Select.Option>
                <Select.Option value="artist">美工师</Select.Option>
                <Select.Option value="manager">管理员</Select.Option>
                <Select.Option value="admin">超级管理员</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="store_id" label="所属店铺">
              <Select placeholder="选择店铺" allowClear>
                {stores.filter((s) => s.status).map((s) => (
                  <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

/* ─── Tab: Role & Permission Management ──────────── */

function RoleTab() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permDefs, setPermDefs] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([getRoles(), getPermissionDefs()]);
      setRoles(r);
      setPermDefs(p);
    } catch { message.error('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditor = (role?: AdminRole) => {
    if (role) {
      setEditingRole(role);
      setEditName(role.name);
      setEditDesc(role.description || '');
      setEditPerms({ ...role.permissions });
    } else {
      setEditingRole(null);
      setEditName('');
      setEditDesc('');
      setEditPerms({});
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) { message.warning('请输入角色名称'); return; }
    try {
      if (editingRole) {
        const updated = await updateRole(editingRole.id, {
          name: editName,
          description: editDesc,
          permissions: editPerms,
        });
        setRoles((prev) => prev.map((r) => r.id === editingRole.id ? { ...r, ...updated, permissions: editPerms } : r));
        message.success('更新成功');
      } else {
        const created = await createRole({ name: editName, description: editDesc, permissions: editPerms });
        setRoles((prev) => [...prev, created]);
        message.success('创建成功');
      }
      setModalOpen(false);
    } catch { message.error('保存失败'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRole(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      message.success('删除成功');
    } catch { message.error('删除失败'); }
  };

  const modules = [...new Set(permDefs.map((p) => p.module))];

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '角色名称', dataIndex: 'name', width: 140 },
    { title: '描述', dataIndex: 'description', width: 200, render: (v: string) => v || '—' },
    {
      title: '权限摘要', key: 'perms', width: 300,
      render: (_: any, r: AdminRole) => {
        const enabled = Object.entries(r.permissions || {}).filter(([, v]) => v).length;
        const total = Object.keys(r.permissions || {}).length;
        return <span className="s-perm-summary">{enabled}/{total} 项权限已启用</span>;
      },
    },
    {
      title: '类型', dataIndex: 'is_system', width: 80,
      render: (v: number) => v ? <Tag color="blue">系统</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: AdminRole) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditor(r)} />
          {!r.is_system && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="s-tab-content">
      <div className="s-tab-header">
        <span className="s-tab-count">共 {roles.length} 个角色</span>
        <Button type="primary" icon={<PlusOutlined />} className="s-btn-primary" onClick={() => openEditor()}>
          新建角色
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={roles}
        loading={loading}
        pagination={false}
        size="middle"
      />
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
        centered
        className="s-modal"
      >
        <div className="s-role-form">
          <div className="s-form-grid">
            <Form.Item label="角色名称" required>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="如: 运营" />
            </Form.Item>
            <Form.Item label="描述">
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="角色说明" />
            </Form.Item>
          </div>
          <div className="s-perm-editor">
            <h4 className="s-perm-title">权限配置</h4>
            {modules.map((mod) => (
              <div key={mod} className="s-perm-module">
                <div className="s-perm-module-header">
                  <span className="s-perm-module-name">{mod}</span>
                  <Button type="link" size="small" onClick={() => {
                    const modulePerms = permDefs.filter((p) => p.module === mod);
                    const allOn = modulePerms.every((p) => editPerms[p.key]);
                    const next = !allOn;
                    setEditPerms((prev) => {
                      const nxt = { ...prev };
                      modulePerms.forEach((p) => { nxt[p.key] = next; });
                      return nxt;
                    });
                  }}>
                    {permDefs.filter((p) => p.module === mod).every((p) => editPerms[p.key]) ? '全部取消' : '全部开启'}
                  </Button>
                </div>
                <div className="s-perm-items">
                  {permDefs.filter((p) => p.module === mod).map((p) => (
                    <label key={p.key} className="s-perm-item">
                      <Switch
                        size="small"
                        checked={!!editPerms[p.key]}
                        onChange={(v) => setEditPerms((prev) => ({ ...prev, [p.key]: v }))}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Tab: Store Management ────────────────────────── */

function StoreTab() {
  const { refreshStores } = useAuth();
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStore | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getStores();
      setStores(s);
    } catch { message.error('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (store?: AdminStore) => {
    setEditing(store || null);
    setModalOpen(true);
    if (store) {
      setTimeout(() => form.setFieldsValue(store), 50);
    } else {
      form.resetFields();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (editing) {
        const updated = await updateStore(editing.id, values);
        setStores((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...updated } : s));
        message.success('更新成功');
      } else {
        const created = await createStore(values);
        setStores((prev) => [...prev, created]);
        message.success('创建成功');
      }
      setModalOpen(false);
      refreshStores();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('操作失败');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStore(id);
      setStores((prev) => prev.filter((s) => s.id !== id));
      refreshStores();
      message.success('删除成功');
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '店铺名称', dataIndex: 'name', width: 160 },
    { title: '店铺代码', dataIndex: 'code', width: 120, render: (v: string) => <code>{v}</code> },
    { title: '所属平台', dataIndex: 'platform', width: 100, render: (v: string) => {
      const labels: Record<string, string> = { pdd: '拼多多', taobao: '淘宝', jd: '京东', douyin: '抖音', weixin: '微信' };
      return labels[v] || v || '—';
    }},
    { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
    { title: '备注', dataIndex: 'remark', render: (v: string) => v || '—' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: AdminStore) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="s-tab-content">
      <div className="s-tab-header">
        <span className="s-tab-count">共 {stores.length} 个店铺</span>
        <Button type="primary" icon={<PlusOutlined />} className="s-btn-primary" onClick={() => openModal()}>
          添加店铺
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={stores}
        loading={loading}
        pagination={false}
        size="middle"
      />
      <Modal
        title={editing ? '编辑店铺' : '添加店铺'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={editing ? '保存' : '添加'}
        cancelText="取消"
        destroyOnClose
        centered
        className="s-modal"
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ platform: 'pdd', status: 1 }}>
          <div className="s-form-grid">
            <Form.Item name="name" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
              <Input placeholder="如: 拼多多旗舰店" />
            </Form.Item>
            <Form.Item name="code" label="店铺代码" rules={[{ required: true, message: '请输入店铺代码' }]}>
              <Input placeholder="如: pddjd（中文名首字母缩写）" />
            </Form.Item>
            <Form.Item name="platform" label="所属平台">
              <Select>
                <Select.Option value="pdd">拼多多</Select.Option>
                <Select.Option value="taobao">淘宝</Select.Option>
                <Select.Option value="jd">京东</Select.Option>
                <Select.Option value="douyin">抖音</Select.Option>
                <Select.Option value="weixin">微信</Select.Option>
                <Select.Option value="">其他</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select>
                <Select.Option value={1}>启用</Select.Option>
                <Select.Option value={0}>停用</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} placeholder="备注信息" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return <div className="s-no-access">无权限访问</div>;
  }

  const tabItems = [
    { key: 'users', label: '用户管理', children: <UserTab /> },
    { key: 'roles', label: '角色权限', children: <RoleTab /> },
    { key: 'stores', label: '店铺管理', children: <StoreTab /> },
  ];

  return (
    <div className="settings-page">
      <div className="settings-bg" />
      <div className="settings-inner">
        <header className="s-header">
          <div>
            <h1 className="s-title">管理中心</h1>
            <p className="s-subtitle">用户 · 角色权限 · 店铺管理</p>
          </div>
        </header>
        <div className="s-card">
          <Tabs items={tabItems} />
        </div>
      </div>
    </div>
  );
}
