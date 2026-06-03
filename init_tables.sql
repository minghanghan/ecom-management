-- ============================================
-- 电商管理系统 - 数据库建表脚本
-- 数据库: ecom_management
-- ============================================
-- 使用方法:
--   mysql -u root -p < init_tables.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS ecom_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ecom_management;

-- ── 用户表 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE COMMENT '手机号(登录名)',
  password VARCHAR(255) NOT NULL COMMENT '密码',
  email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
  nickname VARCHAR(64) DEFAULT NULL COMMENT '昵称',
  role VARCHAR(32) DEFAULT 'user' COMMENT '角色: admin/user/manager/artist',
  store_id INT DEFAULT NULL COMMENT '所属店铺ID',
  role_id INT DEFAULT NULL COMMENT '自定义角色ID',
  status TINYINT DEFAULT 1 COMMENT '1启用 0禁用',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 角色表 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE COMMENT '角色名称',
  description VARCHAR(255) DEFAULT '' COMMENT '描述',
  permissions JSON COMMENT '权限配置JSON',
  is_system TINYINT DEFAULT 0 COMMENT '系统角色不可删除',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 店铺表 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '店铺名称',
  code VARCHAR(32) NOT NULL UNIQUE COMMENT '店铺代码',
  platform VARCHAR(32) DEFAULT '' COMMENT '所属平台',
  status TINYINT DEFAULT 1 COMMENT '1启用 0停用',
  remark VARCHAR(255) DEFAULT '' COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 商品表 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT '商品名称',
  sku VARCHAR(64) NOT NULL COMMENT '商品编号',
  category VARCHAR(64) DEFAULT '' COMMENT '分类',
  price DECIMAL(10,2) DEFAULT 0 COMMENT '售价',
  cost_price DECIMAL(10,2) DEFAULT 0 COMMENT '成本价',
  sizes JSON COMMENT '规格尺寸',
  colors JSON COMMENT '颜色',
  stock INT DEFAULT 0 COMMENT '库存',
  description TEXT COMMENT '商品描述',
  images JSON COMMENT '商品图片',
  status VARCHAR(16) DEFAULT 'online' COMMENT '状态: online/offline',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 订单表 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
  store_id INT DEFAULT NULL COMMENT '所属店铺',
  platform VARCHAR(32) DEFAULT 'pdd' COMMENT '平台',
  product_name VARCHAR(255) COMMENT '商品名称',
  product_sku VARCHAR(64) COMMENT '商品SKU',
  product_specs VARCHAR(255) COMMENT '商品规格',
  quantity INT DEFAULT 1 COMMENT '数量',
  unit_price DECIMAL(10,2) DEFAULT 0 COMMENT '单价',
  total_amount DECIMAL(10,2) DEFAULT 0 COMMENT '总金额',
  discount DECIMAL(10,2) DEFAULT 0 COMMENT '优惠',
  actual_amount DECIMAL(10,2) DEFAULT 0 COMMENT '实付金额',
  status VARCHAR(32) DEFAULT 'pending' COMMENT '订单状态',
  refund_status VARCHAR(32) DEFAULT 'none' COMMENT '售后状态',
  buyer_name VARCHAR(128) COMMENT '买家',
  buyer_phone VARCHAR(32) COMMENT '买家电话',
  shipping_address TEXT COMMENT '收货地址',
  shipping_method VARCHAR(64) COMMENT '物流方式',
  tracking_no VARCHAR(128) COMMENT '物流单号',
  buyer_remark TEXT COMMENT '买家备注',
  seller_remark TEXT COMMENT '卖家备注',
  order_date DATETIME COMMENT '下单时间',
  payment_date DATETIME COMMENT '付款时间',
  shipping_date DATETIME COMMENT '发货时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 需求表 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL COMMENT '商品名称',
  product_sku VARCHAR(64) NOT NULL COMMENT '商品编号',
  links JSON COMMENT '对标链接',
  description TEXT COMMENT '需求描述',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' COMMENT '优先级',
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  assignee_id INT DEFAULT NULL COMMENT '美工师ID',
  artist_completed TINYINT DEFAULT 0 COMMENT '美工师完成标记',
  completion_files JSON COMMENT '完成文件列表',
  claimed_at DATETIME DEFAULT NULL COMMENT '认领时间',
  deploy_completed TINYINT DEFAULT 0 COMMENT '用户布置完成标记',
  deploy_link TEXT COMMENT '用户布置链接',
  store_id INT DEFAULT NULL COMMENT '所属店铺',
  created_by INT NOT NULL COMMENT '提交人ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 聊天消息表 ──────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL COMMENT '发送者ID',
  receiver_id INT DEFAULT NULL COMMENT '接收者ID（NULL=发给管理员）',
  message TEXT NOT NULL COMMENT '消息内容',
  is_read TINYINT DEFAULT 0 COMMENT '0未读 1已读',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 修复：给已存在的表补充缺失的列
-- 如果表已存在但缺少某些列，运行下面语句
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSON COMMENT '商品图片' AFTER description;
