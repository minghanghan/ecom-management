import { Layout, Menu, Button, Typography, Dropdown } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  FileAddOutlined,
  PictureOutlined,
  LinkOutlined,
  HistoryOutlined,
  MoneyCollectOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AythContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘', roles: ['admin', 'manager'] },
  { key: '/products', icon: <ShoppingOutlined />, label: '商品管理', roles: ['admin', 'manager'] },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理', roles: ['admin', 'manager'] },
  { key: '/requirements', icon: <FileAddOutlined />, label: '需求提交', roles: ['admin', 'user'] },
  { key: '/artist-tasks', icon: <PictureOutlined />, label: '美工师任务', roles: ['admin', 'artist'] },
  { key: '/deploy-links', icon: <LinkOutlined />, label: '布置链接', roles: ['admin', 'user'] },
  { key: '/history-tasks', icon: <HistoryOutlined />, label: '历史任务', roles: ['admin', 'manager', 'artist', 'user'] },
  { key: '/finance', icon: <MoneyCollectOutlined />, label: '财务管理', roles: ['admin', 'manager'] },
  { key: '/users', icon: <UserOutlined />, label: '用户管理', roles: ['admin'] },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const filteredMenu = menuItems.filter((item) => user && item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      { key: 'role', label: `角色：${user?.role}`, disabled: true },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
      <Layout>
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
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ fontSize: 18 }} />
              <Text>{user?.nickname || user?.username}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
