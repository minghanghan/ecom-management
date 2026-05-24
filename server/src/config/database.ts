import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecom_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

export default pool;

export const DB_NAME = process.env.DB_NAME || 'ecom_management';

export async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();

  // ── Stores ────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(128) NOT NULL COMMENT '店铺名称',
      code VARCHAR(32) NOT NULL UNIQUE COMMENT '店铺代码',
      platform VARCHAR(32) DEFAULT '' COMMENT '所属平台',
      status TINYINT DEFAULT 1 COMMENT '1启用 0停用',
      remark VARCHAR(255) DEFAULT '' COMMENT '备注',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Roles ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE COMMENT '角色名称',
      description VARCHAR(255) DEFAULT '' COMMENT '描述',
      permissions JSON COMMENT '权限配置JSON',
      is_system TINYINT DEFAULT 0 COMMENT '系统角色不可删除',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Users: add store_id, role_id, change role to VARCHAR ──
  const addCol = async (table: string, col: string, def: string) => {
    try { await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); }
    catch (_e: any) { /* column may already exist */ }
  };
  await addCol('users', 'store_id', 'INT DEFAULT NULL COMMENT \'所属店铺\'');
  await addCol('users', 'role_id', 'INT DEFAULT NULL COMMENT \'角色ID\'');
  try {
    await pool.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(32) DEFAULT 'user'`);
  } catch (_e: any) { /* ok */ }

  // ── Products: remove store_id (not needed) ─────────
  try { await pool.query('ALTER TABLE products DROP COLUMN store_id'); }
  catch (_e: any) { /* column may not exist */ }

  // ── Orders: recreate with store_id ──────────────────
  await pool.query(`DROP TABLE IF EXISTS orders`);
  await pool.query(`
    CREATE TABLE orders (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Requirements ──────────────────────────────────────
  // Drop progress column from existing tables
  try { await pool.query('ALTER TABLE requirements DROP COLUMN progress'); }
  catch (_e: any) { /* may not exist */ }
  // Add artist-related columns to existing tables
  try { await pool.query('ALTER TABLE requirements ADD COLUMN artist_completed TINYINT DEFAULT 0'); }
  catch (_e: any) { /* may already exist */ }
  try { await pool.query('ALTER TABLE requirements ADD COLUMN completion_files JSON'); }
  catch (_e: any) { /* may already exist */ }
  try { await pool.query('ALTER TABLE requirements ADD COLUMN claimed_at DATETIME DEFAULT NULL'); }
  catch (_e: any) { /* may already exist */ }
  try { await pool.query('ALTER TABLE requirements ADD COLUMN deploy_completed TINYINT DEFAULT 0'); }
  catch (_e: any) { /* may already exist */ }
  try { await pool.query('ALTER TABLE requirements ADD COLUMN deploy_link TEXT'); }
  catch (_e: any) { /* may already exist */ }
  try { await pool.query('ALTER TABLE requirements ADD COLUMN store_id INT DEFAULT NULL'); }
  catch (_e: any) { /* may already exist */ }

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Seed default roles ──────────────────────────────
  const [roleRows] = await pool.query<any[]>('SELECT COUNT(*) as cnt FROM roles');
  if (roleRows[0].cnt === 0) {
    const perms = {
      product_view: true, product_create: true, product_edit: true, product_delete: true,
      order_view: true, order_create: true, order_delete: true, order_import: true,
      order_export: true,
      dashboard_view: true,
      settings_access: true, settings_user: true, settings_role: true, settings_store: true,
    };
    const permsView = {
      product_view: true, product_create: false, product_edit: false, product_delete: false,
      order_view: true, order_create: false, order_delete: false, order_import: false,
      order_export: false,
      dashboard_view: true,
      settings_access: false, settings_user: false, settings_role: false, settings_store: false,
    };
    await pool.query(
      `INSERT INTO roles (name, description, permissions, is_system) VALUES
       ('超级管理员', '系统最高权限', ?, 1),
       ('店长', '店铺全部操作权限', ?, 1),
       ('运营', '商品编辑、订单处理', ?, 1),
       ('客服', '查看订单、处理售后', ?, 1)`,
      [JSON.stringify(perms), JSON.stringify(perms), JSON.stringify(perms), JSON.stringify(permsView)]
    );
  }

  // ── Seed default store ──────────────────────────────
  const [storeRows] = await pool.query<any[]>('SELECT COUNT(*) as cnt FROM stores');
  if (storeRows[0].cnt === 0) {
    await pool.query(
      `INSERT INTO stores (name, code, platform, remark) VALUES
       ('默认店铺', 'default', 'pdd', '系统默认店铺')`
    );
  } else if (storeRows[0].cnt === 1) {
    // Add more stores if only default exists
    try {
      await pool.query(
        `INSERT IGNORE INTO stores (name, code, platform, status, remark) VALUES
         ('拼多多旗舰店', 'pddsd', 'pdd', 1, '拼多多主营店铺'),
         ('淘宝品牌店', 'tbsd', 'taobao', 1, '淘宝官方品牌店'),
         ('京东专营店', 'jdsd', 'jd', 1, '京东授权专营店')`
      );
    } catch (_e: any) { /* may already exist */ }
  }

  // ── Seed products ──────────────────────────────────
  const [productRows] = await pool.query<any[]>('SELECT COUNT(*) as cnt FROM products');
  if (productRows[0].cnt < 5) {
    const products: any[] = [
      ['纯棉圆领T恤', 'T-001', '服装', 89, 45, '["S","M","L","XL"]', '["白色","黑色","灰色"]', 500, '100%纯棉，舒适透气'],
      ['修身连衣裙', 'D-001', '服装', 199, 98, '["S","M","L"]', '["黑色","藏青","酒红"]', 200, '法式复古风格'],
      ['直筒牛仔裤', 'J-001', '服装', 159, 75, '["28","29","30","31","32"]', '["深蓝","浅蓝","黑色"]', 350, '经典百搭款'],
      ['连帽卫衣', 'H-001', '服装', 129, 60, '["M","L","XL","XXL"]', '["灰色","黑色","军绿"]', 280, '加绒保暖'],
      ['轻薄羽绒服', 'DN-001', '服装', 399, 200, '["M","L","XL","XXL"]', '["黑色","白色","蓝色"]', 150, '90%白鸭绒填充'],
      ['玻尿酸精华液', 'BZ-001', '美妆', 169, 80, '["30ml","50ml"]', '["透明"]', 250, '深层补水保湿'],
      ['修护面霜', 'MS-001', '美妆', 139, 65, '["50g"]', '["白色"]', 300, '敏感肌适用'],
      ['补水面膜(10片装)', 'MM-001', '美妆', 59, 25, '["10片/盒"]', '["白色"]', 800, '玻尿酸深层补水'],
      ['哑光口红', 'LIP-001', '美妆', 79, 35, '["3.5g"]', '["正红","豆沙","砖红","珊瑚"]', 400, '丝绒质地不沾杯'],
      ['大地色眼影盘', 'EYE-001', '美妆', 99, 45, '["12色盘"]', '["大地色系"]', 200, '日常百搭哑光微闪'],
      ['蓝牙耳机Pro', 'BT-001', '数码', 299, 150, '["标准版","降噪版"]', '["白色","黑色"]', 180, '主动降噪30小时续航'],
      ['20000mAh充电宝', 'CP-001', '数码', 129, 68, '["20000mAh"]', '["白色","黑色","红色"]', 350, '快充大容量'],
      ['Type-C快充数据线', 'CBL-001', '数码', 29, 12, '["1m","2m"]', '["黑色","白色"]', 1000, '100W快充编织线'],
      ['硅胶手机壳', 'PHC-001', '数码', 19, 8, '["通用"]', '["透明","黑色","蓝色","粉色"]', 2000, '防摔软壳'],
      ['北欧风台灯', 'LMP-001', '家居', 89, 40, '["标准款"]', '["白色","黑色"]', 120, '三档调光护眼'],
      ['沙发抱枕', 'PLL-001', '家居', 49, 22, '["45cm*45cm"]', '["灰色","米色","蓝色"]', 300, '羽绒毛填充'],
      ['抽屉收纳盒', 'STO-001', '家居', 35, 15, '["单件","三件套"]', '["白色","米色"]', 500, '加厚PP材质'],
      ['进门地毯', 'RUG-001', '家居', 69, 30, '["40*60cm","50*80cm"]', '["灰色","咖色"]', 200, '防滑吸水易清洁'],
      ['每日坚果礼盒', 'NUT-001', '食品', 99, 55, '["750g/箱"]', '["礼盒装"]', 400, '7种坚果每日一包'],
      ['特级红枣', 'JNJ-001', '食品', 39, 18, '["500g/袋"]', '["袋装"]', 600, '新疆和田大枣'],
      ['纯棉T恤(拼多多)', 'T-002', '服装', 69, 35, '["M","L","XL"]', '["白色","黑色"]', 800, '高性价比纯棉T恤'],
      ['休闲运动鞋', 'SH-001', '鞋帽', 169, 85, '["39","40","41","42","43"]', '["白色","黑色"]', 250, '飞织透气运动鞋'],
      ['棒球帽', 'CAP-001', '鞋帽', 39, 18, '["可调节"]', '["黑色","白色","藏青"]', 500, '纯棉透气遮阳'],
      ['压缩毛巾(50粒)', 'TWL-001', '家居', 25, 10, '["50粒/罐"]', '["白色"]', 1000, '一次性压缩旅行装'],
      ['手机支架', 'HOL-001', '数码', 15, 6, '["通用"]', '["黑色","白色"]', 1500, '桌面可调节'],
      ['真丝衬衫', 'SHT-001', '服装', 359, 180, '["S","M","L","XL"]', '["白色","米色","浅蓝"]', 100, '100%桑蚕丝'],
      ['手工皂礼盒', 'SOAP-001', '美妆', 79, 35, '["6块装"]', '["礼盒装"]', 200, '天然植物精油手工皂'],
      ['真皮腰带', 'BLT-001', '配饰', 189, 90, '["105cm","115cm","125cm"]', '["黑色","棕色"]', 150, '头层牛皮自动扣'],
      ['羊毛围巾', 'SCF-001', '配饰', 259, 130, '["180*30cm"]', '["灰色","驼色","黑色"]', 100, '100%澳洲羊毛'],
      ['保温咖啡杯', 'CUP-001', '家居', 89, 42, '["350ml","500ml"]', '["白色","黑色","红色"]', 300, '316不锈钢内胆'],
    ];

    for (const p of products) {
      try {
        await pool.query(
          `INSERT IGNORE INTO products (name, sku, category, price, cost_price, sizes, colors, stock, description, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'online')`,
          [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]]
        );
      } catch (_e: any) { /* skip duplicates */ }
    }
  }

  // ── Seed orders ────────────────────────────────────
  const [orderRows] = await pool.query<any[]>('SELECT COUNT(*) as cnt FROM orders');
  if (orderRows[0].cnt < 5) {
    const now = new Date();
    const d = (daysAgo: number) => {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - daysAgo);
      return dt.toISOString().slice(0, 19).replace('T', ' ');
    };

    const orders: any[] = [
      // store_id=1 orders (10 orders)
      ['ORD-20260501001', 1, 'pdd', '纯棉圆领T恤', '白色 / XL', 2, 89, 178, 10, 168, 'paid', 'none', '张伟', '13800138001', '北京市朝阳区建国路88号', '中通快递', 'ZT1000001', d(5), d(5), null],
      ['ORD-20260502002', 1, 'pdd', '修护面霜', '50g', 1, 139, 139, 0, 139, 'shipped', 'none', '李娜', '13900139002', '上海市浦东新区张江路100号', '圆通速递', 'YT2000002', d(4), d(4), d(3)],
      ['ORD-20260503003', 1, 'taobao', '蓝牙耳机Pro', '降噪版', 1, 299, 299, 20, 279, 'delivered', 'none', '王强', '13700137003', '广州市天河区天河路200号', '顺丰速运', 'SF3000003', d(7), d(7), d(6)],
      ['ORD-20260504004', 1, 'taobao', '玻尿酸精华液', '50ml', 2, 169, 338, 30, 308, 'completed', 'none', '赵敏', '13600136004', '深圳市南山区科技园路50号', '中通快递', 'ZT4000004', d(10), d(10), d(9)],
      ['ORD-20260505005', 1, 'jd', '轻薄羽绒服', '黑色 / M', 1, 399, 399, 50, 349, 'completed', 'none', '刘洋', '13500135005', '杭州市西湖区文三路300号', '京东快递', 'JD5000005', d(12), d(12), d(11)],
      ['ORD-20260506006', 1, 'pdd', '每日坚果礼盒', '礼盒装', 3, 99, 297, 20, 277, 'completed', 'none', '陈静', '13400134006', '成都市锦江区红星路400号', '圆通速递', 'YT6000006', d(14), d(14), d(13)],
      ['ORD-20260507007', 1, 'pdd', '大地色眼影盘', '12色盘', 1, 99, 99, 0, 99, 'pending', 'none', '孙悦', '13300133007', '武汉市洪山区珞瑜路500号', '', '', d(1), null, null],
      ['ORD-20260508008', 1, 'taobao', '补水面膜(10片装)', '10片/盒', 4, 59, 236, 0, 236, 'paid', 'none', '周杰', '13200132008', '南京市鼓楼区中山北路600号', '中通快递', '', d(2), d(2), null],
      ['ORD-20260509009', 1, 'jd', '20000mAh充电宝', '白色', 1, 129, 129, 10, 119, 'cancelled', 'none', '吴芳', '13100131009', '长沙市岳麓区麓山路700号', '', '', d(8), null, null],
      ['ORD-20260510010', 1, 'pdd', '纯棉圆领T恤', '灰色 / L', 2, 89, 178, 0, 178, 'shipped', 'refunding', '林涛', '13000130010', '西安市雁塔区长安南路800号', '圆通速递', 'YT7000010', d(3), d(3), d(1)],
      // store_id=2 orders (3 orders)
      ['ORD-20260511011', 2, 'pdd', '纯棉T恤(拼多多)', '白色 / M', 5, 69, 345, 25, 320, 'completed', 'none', '黄丽', '15900159011', '东莞市长安镇德政路100号', '中通快递', 'ZT8000011', d(15), d(15), d(14)],
      ['ORD-20260512012', 2, 'pdd', '休闲运动鞋', '白色 / 42', 1, 169, 169, 0, 169, 'delivered', 'none', '何强', '15800158012', '苏州市姑苏区人民路200号', '圆通速递', 'YT9000012', d(6), d(6), d(5)],
      ['ORD-20260513013', 2, 'pdd', '棒球帽', '黑色 / 可调节', 2, 39, 78, 0, 78, 'shipped', 'none', '杨雪', '15700157013', '青岛市市南区香港中路300号', '申通快递', 'ST1000013', d(2), d(2), d(1)],
      // store_id=3 orders (2 orders)
      ['ORD-20260514014', 3, 'taobao', '真丝衬衫', '白色 / M', 1, 359, 359, 30, 329, 'paid', 'none', '马超', '15600156014', '厦门市思明区湖滨北路400号', '顺丰速运', '', d(1), d(1), null],
      ['ORD-20260515015', 3, 'taobao', '手工皂礼盒', '礼盒装', 2, 79, 158, 10, 148, 'completed', 'none', '朱敏', '15500155015', '郑州市金水区花园路500号', '中通快递', 'ZT1100015', d(20), d(20), d(19)],
      // store_id=1 additional (3 orders)
      ['ORD-20260516016', 1, 'taobao', '北欧风台灯', '白色', 1, 89, 89, 0, 89, 'pending', 'none', '程龙', '18800000124', '合肥市蜀山区黄山路200号', '', '', d(0), null, null],
      ['ORD-20260517017', 1, 'jd', 'Type-C快充数据线', '2m/黑色', 3, 29, 87, 0, 87, 'completed', 'exchanged', '张雪', '18800000125', '福州市鼓楼区东街300号', '京东快递', 'JD1200018', d(11), d(11), d(10)],
      ['ORD-20260518018', 1, 'pdd', '连帽卫衣', '灰色 / L', 1, 129, 129, 0, 129, 'pending', 'none', '刘飞', '18800000123', '昆明市五华区人民中路100号', '', '', d(0), null, null],
    ];

    for (const o of orders) {
      // Pad to 20 columns (exactly matching INSERT columns)
      while (o.length < 20) o.push(null);
      try {
        await pool.query(
          `INSERT IGNORE INTO orders
           (order_no, store_id, platform, product_name, product_specs, quantity, unit_price, total_amount, discount, actual_amount,
            status, refund_status, buyer_name, buyer_phone, shipping_address, shipping_method, tracking_no,
            order_date, payment_date, shipping_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          o.slice(0, 20)
        );
      } catch (_e: any) { /* skip duplicates */ }
    }
  }

  console.log('Database initialized successfully');
}
