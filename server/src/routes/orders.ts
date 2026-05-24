import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `import-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'] as const;
const REFUND_STATUSES = ['none', 'refunding', 'refunded', 'exchanged'] as const;

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled', 'refunding'],
  shipped: ['delivered', 'refunding'],
  delivered: ['completed', 'refunding'],
  completed: [],
  cancelled: [],
};

router.use(authenticate);

// GET /api/orders — paginated list with filters
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const platform = req.query.platform as string | undefined;
    const status = req.query.status as string | undefined;
    const refundStatus = req.query.refundStatus as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const sortField = (req.query.sortField as string) || 'order_date';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const allowedSortFields = ['order_no', 'total_amount', 'actual_amount', 'quantity', 'status', 'order_date', 'created_at', 'updated_at'];
    const safeField = allowedSortFields.includes(sortField) ? `o.${sortField}` : 'o.order_date';
    const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: any[] = [];
    const storeId = (req.query.store_id as string) || (req.user?.store_id ? String(req.user.store_id) : undefined);
    if (storeId) {
      conditions.push('o.store_id = ?');
      params.push(storeId);
    }

    if (platform) {
      conditions.push('o.platform = ?');
      params.push(platform);
    }
    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (refundStatus) {
      if (refundStatus === 'none') {
        conditions.push("(o.refund_status = 'none' OR o.refund_status IS NULL)");
      } else {
        conditions.push('o.refund_status = ?');
        params.push(refundStatus);
      }
    }
    if (dateFrom) {
      conditions.push('o.order_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('o.order_date <= ?');
      params.push(dateTo);
    }
    if (search) {
      conditions.push('(o.order_no LIKE ? OR o.product_name LIKE ? OR o.buyer_name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM orders o ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.* FROM orders o ${where} ORDER BY ${safeField} ${safeOrder} LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    );

    		// Status counts for stats (only filter by store)
		const statsConditions: string[] = [];
		const statsParams: any[] = [];
		if (storeId) {
		  statsConditions.push('o.store_id = ?');
		  statsParams.push(storeId);
		}
		const statsWhere = statsConditions.length ? `WHERE ${statsConditions.join(' AND ')}` : '';
		const [statusCounts] = await pool.execute<RowDataPacket[]>(
		  `SELECT status, COUNT(*) as count FROM orders o ${statsWhere} GROUP BY status`,
		  statsParams
		);
		res.json({
      orders: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      stats: statusCounts.reduce((acc: any, r: any) => ({ ...acc, [r.status]: r.count }), {}),
    });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/orders/stats — quick stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
    const [pendingRefund] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM orders WHERE refund_status = 'refunding'"
    );
    const stats = rows.reduce((acc: any, r: any) => ({ ...acc, [r.status]: r.count }), {});
    stats.refunding = pendingRefund[0].count;
    res.json(stats);
  } catch (error) {
    console.error('Orders stats error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/orders/export — export filtered orders
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const platform = req.query.platform as string | undefined;
    const status = req.query.status as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const conditions: string[] = [];
    const params: any[] = [];

    if (platform) { conditions.push('platform = ?'); params.push(platform); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (dateFrom) { conditions.push('order_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('order_date <= ?'); params.push(dateTo); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM orders ${where} ORDER BY order_date DESC`,
      params
    );

    const data = rows.map((r: any) => ({
      '订单号': r.order_no,
      '平台': r.platform,
      '商品名称': r.product_name || '',
      '规格': r.product_specs || '',
      '数量': r.quantity,
      '单价': Number(r.unit_price),
      '总金额': Number(r.total_amount),
      '优惠': Number(r.discount),
      '实付': Number(r.actual_amount),
      '订单状态': r.status,
      '售后状态': r.refund_status || '无',
      '买家': r.buyer_name || '',
      '联系电话': r.buyer_phone || '',
      '收货地址': r.shipping_address || '',
      '物流方式': r.shipping_method || '',
      '物流单号': r.tracking_no || '',
      '下单时间': r.order_date || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '订单');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=orders-${Date.now()}.xlsx`);
    res.send(buf);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: '导出失败' });
  }
});

// POST /api/orders/import — import from Excel/CSV
router.post('/import', authorize('admin', 'manager'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: '请上传文件' });
      return;
    }

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws);
    fs.unlink(req.file.path, () => {});

    if (raw.length === 0) {
      res.status(400).json({ message: '文件为空' });
      return;
    }

    // Column mapping — detect common PD export headers
    const headers = Object.keys(raw[0]);
    const map: Record<string, string> = {};
    const headerMap: [RegExp, string][] = [
      [/订单号|订单编号|order.?no|order.?id/i, 'order_no'],
      [/^平台$|^来源$|平台名称|所属平台|订单来源|platform/i, 'platform'],
      [/^商品$|商品名称|产品名称|商品.*名|product.?name/i, 'product_name'],
      [/商品规格|规格|sku|spec/i, 'product_specs'],
      [/数量|购买数量|qty|quantity/i, 'quantity'],
      [/单价|unit.?price/i, 'unit_price'],
      [/总金额|总价|合计|总额|total/i, 'total_amount'],
      [/优惠|折扣|discount/i, 'discount'],
      [/实付|实收款|实际支付|实际收款/i, 'actual_amount'],
      [/订单状态|^状态$/i, 'status'],
      [/收件人|收货人|买家|buyer.?name|receiver/i, 'buyer_name'],
      [/手机号|电话|手机|联系电话|phone|mobile/i, 'buyer_phone'],
      [/收货地址|地址|address/i, 'shipping_address'],
      [/物流公司|物流方式|快递|shipping.?method/i, 'shipping_method'],
      [/物流单号|快递单号|tracking.?no/i, 'tracking_no'],
      [/买家备注|备注|remark/i, 'buyer_remark'],
      [/下单时间|订单时间|成交时间|创建时间|order.?date|created.?at/i, 'order_date'],
      [/付款时间|支付时间|payment/i, 'payment_date'],
      [/发货时间|shipping.?date/i, 'shipping_date'],
    ];

    for (const h of headers) {
      for (const [pattern, field] of headerMap) {
        if (pattern.test(h)) {
          map[h] = field;
          break;
        }
      }
    }

    // Check if we have at least order_no or product_name
    const mappedFields = new Set(Object.values(map));
    if (!mappedFields.has('order_no') && !mappedFields.has('product_name')) {
      res.status(400).json({
        message: '无法识别文件格式，请确保包含"订单号"或"商品名称"列',
        headers,
      });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const mapped: any = { status: 'pending', refund_status: 'none' };

      for (const [header, field] of Object.entries(map)) {
        mapped[field] = row[header];
      }

      if (!mapped.order_no) {
        mapped.order_no = `IMP-${Date.now()}-${i}`;
      }

      if (mapped.quantity) mapped.quantity = Number(mapped.quantity) || 1;
      if (mapped.unit_price) mapped.unit_price = Number(mapped.unit_price) || 0;
      if (mapped.total_amount) mapped.total_amount = Number(mapped.total_amount) || 0;
      if (mapped.discount) mapped.discount = Number(mapped.discount) || 0;
      if (mapped.actual_amount) mapped.actual_amount = Number(mapped.actual_amount) || 0;

      // Map status from Chinese to internal
      const statusMap: Record<string, string> = {
        '待付款': 'pending', 'pending': 'pending',
        '已付款': 'paid', 'paid': 'paid', '待发货': 'paid',
        '已发货': 'shipped', 'shipped': 'shipped', '已发货，待收货': 'shipped',
        '已送达': 'delivered', '已完成': 'completed', 'completed': 'completed', '已收货': 'delivered',
        '已取消': 'cancelled', 'cancelled': 'cancelled',
        '退款中': 'refunding', '已退款': 'refunded',
						      '未发货，退款成功': 'cancelled', '已发货，退款成功': 'refunded',
      };
      if (mapped.status) {
        const st = String(mapped.status).trim();
        mapped.status = statusMap[st] || st;
      }

      if (mapped.order_date) {
        // Handle Excel serial date numbers (e.g., 46157.48 from PDD CSV)
        if (typeof mapped.order_date === 'number') {
          mapped.order_date = new Date((mapped.order_date - 25569) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
        } else {
          const d = new Date(mapped.order_date);
          mapped.order_date = isNaN(d.getTime()) ? mapped.order_date : d.toISOString().slice(0, 19).replace('T', ' ');
        }
      }
      if (mapped.payment_date && typeof mapped.payment_date === 'number') {
        mapped.payment_date = new Date((mapped.payment_date - 25569) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      }
      if (mapped.shipping_date && typeof mapped.shipping_date === 'number') {
        mapped.shipping_date = new Date((mapped.shipping_date - 25569) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      }
      

      try {
        await pool.execute<ResultSetHeader>(
          `INSERT IGNORE INTO orders
            (order_no, platform, product_name, product_specs, quantity, unit_price, total_amount, discount, actual_amount,
             status, refund_status, buyer_name, buyer_phone, shipping_address, shipping_method, tracking_no,
             buyer_remark, order_date, payment_date, shipping_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mapped.order_no, mapped.platform || 'pdd', mapped.product_name || null, mapped.product_specs || null,
            mapped.quantity || 1, mapped.unit_price || 0, mapped.total_amount || 0, mapped.discount || 0, mapped.actual_amount || 0,
            mapped.status || 'pending', mapped.refund_status || 'none',
            mapped.buyer_name || null, mapped.buyer_phone || null, mapped.shipping_address || null,
            mapped.shipping_method || null, mapped.tracking_no || null, mapped.buyer_remark || null,
            mapped.order_date || null, mapped.payment_date || null, mapped.shipping_date || null,
          ]
        );
        imported++;
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          errors.push(`第 ${i + 1} 行: ${e.message}`);
        }
      }
    }

    res.json({
      message: `导入完成：新增 ${imported} 条，跳过 ${skipped} 条重复${errors.length ? `，${errors.length} 条错误` : ''}`,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: '导入失败' });
  }
});

// POST /api/orders — create order
router.post('/', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { order_no, platform, product_name, product_sku, product_specs, quantity, unit_price, total_amount, discount, actual_amount,
      buyer_name, buyer_phone, shipping_address, shipping_method, tracking_no, buyer_remark, seller_remark, order_date } = req.body;

    if (!order_no && !product_name) {
      res.status(400).json({ message: '订单号或商品名称不能为空' });
      return;
    }

    const orderNo = order_no || `ORD-${Date.now()}`;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO orders (order_no, platform, product_name, product_sku, product_specs, quantity, unit_price, total_amount, discount, actual_amount, status, refund_status, buyer_name, buyer_phone, shipping_address, shipping_method, tracking_no, buyer_remark, seller_remark, order_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'none', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNo, platform || 'pdd', product_name || null, product_sku || null, product_specs || null,
        quantity || 1, unit_price || 0, total_amount || 0, discount || 0, actual_amount || 0,
        buyer_name || null, buyer_phone || null, shipping_address || null, shipping_method || null,
        tracking_no || null, buyer_remark || null, seller_remark || null, order_date || null,
      ]
    );

    const [created] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/orders/:id — order detail
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ message: '订单不存在' });
      return;
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/orders/:id — update order
router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '订单不存在' });
      return;
    }

    const fields = [
      'product_name', 'product_sku', 'product_specs', 'quantity', 'unit_price', 'total_amount', 'discount', 'actual_amount',
      'buyer_name', 'buyer_phone', 'shipping_address', 'shipping_method', 'tracking_no', 'buyer_remark', 'seller_remark',
      'platform', 'order_date', 'payment_date', 'shipping_date',
    ];
    const sets: string[] = [];
    const params: any[] = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }

    if (sets.length) {
      params.push(req.params.id);
      await pool.execute<ResultSetHeader>(
        `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`,
        params
      );
    }

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/orders/batch — batch delete
router.delete('/batch', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: '请提供要删除的ID列表' });
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM orders WHERE id IN (${placeholders})`,
      ids
    );
    res.json({ message: `成功删除 ${result.affectedRows} 条记录`, deleted: result.affectedRows });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM orders WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '订单不存在' });
      return;
    }
    await pool.execute('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/orders/:id/status — status transition
router.put('/:id/status', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '订单不存在' });
      return;
    }

    const order = existing[0] as any;
    const allowed = STATUS_TRANSITIONS[order.status] || [];

    if (!allowed.includes(status)) {
      res.status(400).json({
        message: `无法从 "${order.status}" 流转到 "${status}"`,
        currentStatus: order.status,
        allowedTransitions: allowed,
      });
      return;
    }

    const updateFields: any = { status };
    if (status === 'paid') updateFields.payment_date = new Date();
    if (status === 'shipped') updateFields.shipping_date = new Date();

    await pool.execute<ResultSetHeader>(
      `UPDATE orders SET status = ?, payment_date = ?, shipping_date = ? WHERE id = ?`,
      [updateFields.status, updateFields.payment_date || order.payment_date, updateFields.shipping_date || order.shipping_date, req.params.id]
    );

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Status transition error:', error);
    res.status(500).json({ message: '操作失败' });
  }
});

// PUT /api/orders/:id/refund — set refund/after-sale status
router.put('/:id/refund', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { refund_status, seller_remark } = req.body;

    const [existing] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '订单不存在' });
      return;
    }

    if (!REFUND_STATUSES.includes(refund_status)) {
      res.status(400).json({ message: '无效的售后状态' });
      return;
    }

    const order = existing[0] as any;
    const updateSql = seller_remark !== undefined
      ? 'UPDATE orders SET refund_status = ?, seller_remark = ? WHERE id = ?'
      : 'UPDATE orders SET refund_status = ? WHERE id = ?';
    const updateParams = seller_remark !== undefined
      ? [refund_status, seller_remark, req.params.id]
      : [refund_status, req.params.id];

    await pool.execute<ResultSetHeader>(updateSql, updateParams);

    // If refunded, also cancel the order
    if (refund_status === 'refunded' && order.status !== 'cancelled') {
      await pool.execute<ResultSetHeader>('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    }

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Refund operation error:', error);
    res.status(500).json({ message: '操作失败' });
  }
});

export default router;
