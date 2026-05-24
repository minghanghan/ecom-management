import { Request } from 'express';

export interface User {
  id: number;
  username: string;
  password: string;
  email: string | null;
  nickname: string | null;
  role: string;
  store_id: number | null;
  role_id: number | null;
  status: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithoutPassword {
  id: number;
  username: string;
  email: string | null;
  nickname: string | null;
  role: string;
  store_id: number | null;
  role_id: number | null;
  permissions: Record<string, boolean>;
  status: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  store_id: number | null;
  role_id: number | null;
  permissions: Record<string, boolean>;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface Store {
  id: number;
  name: string;
  code: string;
  platform: string;
  status: number;
  remark: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_system: number;
  created_at: string;
}

export const PERMISSION_DEFS: { key: string; label: string; module: string }[] = [
  // 商品管理
  { key: 'product_view', label: '查看商品', module: '商品管理' },
  { key: 'product_create', label: '添加商品', module: '商品管理' },
  { key: 'product_edit', label: '编辑商品', module: '商品管理' },
  { key: 'product_delete', label: '删除商品', module: '商品管理' },
  // 订单管理
  { key: 'order_view', label: '查看订单', module: '订单管理' },
  { key: 'order_create', label: '创建订单', module: '订单管理' },
  { key: 'order_delete', label: '删除订单', module: '订单管理' },
  { key: 'order_import', label: '导入订单', module: '订单管理' },
  { key: 'order_export', label: '导出订单', module: '订单管理' },
  // 仪表盘
  { key: 'dashboard_view', label: '查看仪表盘', module: '仪表盘' },
  // 管理中心
  { key: 'settings_access', label: '访问管理中心', module: '管理中心' },
  { key: 'settings_user', label: '用户管理', module: '管理中心' },
  { key: 'settings_role', label: '角色管理', module: '管理中心' },
  { key: 'settings_store', label: '店铺管理', module: '管理中心' },
  // 美工师任务
  { key: 'artist_task_view', label: '查看任务', module: '美工师任务' },
  { key: 'artist_task_claim', label: '认领任务', module: '美工师任务' },
  { key: 'artist_task_upload', label: '上传设计稿', module: '美工师任务' },
  { key: 'artist_task_complete', label: '完成任务', module: '美工师任务' },
];
