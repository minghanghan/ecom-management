import { Layout, Menu, Button, Typography, Dropdown, Select, Space } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  FileAddOutlined,
  PictureOutlined,
  HistoryOutlined,
  MoneyCollectOutlined,
  SettingOutlined,
  ShopOutlined,
  SendOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AythContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘', roles: ['admin'] },
  { key: '/products', icon: <ShoppingOutlined />, label: '商品管理', roles: ['admin', 'manager', 'user'] },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理', roles: ['admin', 'manager', 'user'] },
  { key: '/requirements', icon: <FileAddOutlined />, label: '需求提交', roles: ['admin', 'user'] },
  { key: '/artist-tasks', icon: <PictureOutlined />, label: '美工师任务', roles: ['admin', 'artist'] },
  { key: '/deploy-links', icon: <SendOutlined />, label: '布置链接', roles: ['admin', 'user'] },
  { key: '/finance', icon: <MoneyCollectOutlined />, label: '财务管理', roles: ['admin', 'manager'] },
  { key: '/settings', icon: <SettingOutlined />, label: '管理中心', roles: ['admin'] },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, stores, selectedStoreId, setSelectedStoreId, refreshUser } = useAuth();
  const hiddenStorePaths = ['/products', '/requirements', '/settings'];

  // Refresh user data on each navigation so permission changes take effect immediately
  useEffect(() => {
    refreshUser();
  }, [location.key, refreshUser]);

  const filteredMenu = menuItems.filter((item) => {
    if (!user) return false;
    if (item.roles.includes(user.role)) return true;
    // Also show if user has the corresponding permission
    const permMap: Record<string, string> = {
      '/': 'dashboard_view',
      '/artist-tasks': 'artist_task_view',
    };
    const requiredPerm = permMap[item.key];
    return requiredPerm ? !!user.permissions?.[requiredPerm] : false;
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      { key: 'role', label: `角色：${user?.role_name || user?.role}`, disabled: true },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 'bold' }}>
          {collapsed ? '电商' : '电商管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={filteredMenu}
          onClick={({ key }: { key: string }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ overflow: 'hidden' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Space size={12}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            {(stores.length > 0 && !hiddenStorePaths.includes(location.pathname)) && (
              <Select
                value={selectedStoreId ?? 0}
                style={{ width: 180 }}
                onChange={(val) => setSelectedStoreId(val === 0 ? null : val)}
              >
                <Select.Option value={0}>
                  <Space size={6}>
                    <ShopOutlined />
                    全部店铺
                  </Space>
                </Select.Option>
                {stores.map((s) => (
                  <Select.Option key={s.id} value={s.id}>
                    <Space size={6}>
                      <ShopOutlined />
                      {s.name}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            )}
          </Space>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ fontSize: 18 }} />
              <Text>{user?.nickname || user?.username}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280, overflowX: 'hidden', overflowY: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
