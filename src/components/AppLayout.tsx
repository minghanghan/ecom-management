import { Layout, Menu, Button, Typography, Dropdown, Select, Space, Badge, Drawer, Grid } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  FileAddOutlined,
  PictureOutlined,
  HistoryOutlined,
  SettingOutlined,
  ShopOutlined,
  SendOutlined,
  MessageOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AythContext';
import ChatWidget from './ChatWidget';
import { getUnreadCount, subscribeChat } from '../api/chat';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, stores, selectedStoreId, setSelectedStoreId, refreshUser } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg; // lg = 992px, treat below as mobile

  const hiddenStorePaths = ['/products', '/requirements', '/settings'];

  // Refresh user data on each navigation so permission changes take effect immediately
  useEffect(() => {
    refreshUser();
  }, [location.key, refreshUser]);

  // Poll unread chat count for admin badge
  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const count = await getUnreadCount();
      setUnreadChatCount(count);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const cleanupSse = subscribeChat(fetchUnread);
    const interval = setInterval(fetchUnread, 10000);
    return () => { cleanupSse(); clearInterval(interval); };
  }, [user, fetchUnread]);

  // Close mobile drawer on navigation
  const handleNavigate = (key: string) => {
    navigate(key);
    if (isMobile) setMobileDrawerOpen(false);
  };

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘', roles: ['admin'] },
    { key: '/products', icon: <ShoppingOutlined />, label: '商品管理', roles: ['admin', 'manager', 'user'] },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '订单管理', roles: ['admin', 'manager', 'user'] },
    { key: '/requirements', icon: <FileAddOutlined />, label: '需求提交', roles: ['admin', 'user'] },
    { key: '/artist-tasks', icon: <PictureOutlined />, label: '美工师任务', roles: ['admin', 'artist'] },
    { key: '/deploy-links', icon: <SendOutlined />, label: '布置链接', roles: ['admin', 'user'] },
    { key: '/chat', icon: <Badge count={unreadChatCount} size="small"><MessageOutlined /></Badge>, label: '消息管理', roles: ['admin'] },
    { key: '/settings', icon: <SettingOutlined />, label: '管理中心', roles: ['admin'] },
  ];

  const filteredMenu = menuItems.filter((item) => {
    if (!user) return false;
    if (item.roles.includes(user.role)) return true;
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

  const renderMenu = (theme: 'dark' | 'light' = 'dark') => (
    <Menu
      theme={theme}
      mode="inline"
      selectedKeys={[location.pathname]}
      items={filteredMenu}
      onClick={({ key }: { key: string }) => handleNavigate(key)}
    />
  );

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sider trigger={null} collapsible collapsed={collapsed}>
          <div style={{
            height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 'bold',
          }}>
            {collapsed ? '电商' : '电商管理系统'}
          </div>
          {renderMenu('dark')}
        </Sider>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          title="菜单"
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          size="default"
          styles={{ body: { padding: 0 } }}
        >
          {renderMenu('light')}
        </Drawer>
      )}

      <Layout style={{ overflow: 'hidden' }}>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Space size={isMobile ? 8 : 12}>
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
            {(stores.length > 0 && !hiddenStorePaths.includes(location.pathname)) && (
              <Select
                value={selectedStoreId ?? 0}
                style={{ width: isMobile ? 120 : 180 }}
                onChange={(val) => setSelectedStoreId(val === 0 ? null : val)}
                size={isMobile ? 'small' : 'middle'}
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
              {!isMobile && <Text>{user?.nickname || user?.username}</Text>}
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: isMobile ? 8 : 24,
            padding: isMobile ? 12 : 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
            overflowX: 'auto',
            overflowY: 'auto',
          }}
        >
          <div style={{ minWidth: isMobile ? 320 : 'auto' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
      <ChatWidget />
    </Layout>
  );
}
