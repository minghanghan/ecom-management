import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/products — paginated list with search/filter
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined; // online / offline
    const sortField = (req.query.sortField as string) || 'id';
    const sortOrder = (req.query.sortOrder as string) || 'asc';

    const allowedSortFields = ['category', 'price', 'stock', 'status', 'updated_at', 'id', 'created_at'];
    const safeField = allowedSortFields.includes(sortField) ? `p.${sortField}` : 'p.id';
    const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const conditions: string[] = [];
    const params: any[] = [];

    if (status === 'online' || status === 'offline') {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like);
    }

    if (category) {
      conditions.push('p.category = ?');
      params.push(category);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countParams = [...params];
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM products p ${where}`,
      countParams
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.* FROM products p ${where} ORDER BY ${safeField} ${safeOrder} LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    );

    // Parse JSON fields
    const products = (rows as any[]).map((p) => ({
      ...p,
      sizes: p.sizes ? safeParseJSON(p.sizes) : [],
      colors: p.colors ? safeParseJSON(p.colors) : [],
      images: p.images ? safeParseJSON(p.images) : [],
      price: Number(p.price),
      cost_price: Number(p.cost_price),
    }));

    res.json({
      products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Products list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/products/categories — distinct categories
router.get('/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category"
    );
    res.json(rows.map((r) => r.category));
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/products/:id — single product
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM products WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: '商品不存在' });
      return;
    }
    const p = rows[0] as any;
    res.json({
      ...p,
      sizes: p.sizes ? safeParseJSON(p.sizes) : [],
      colors: p.colors ? safeParseJSON(p.colors) : [],
      images: p.images ? safeParseJSON(p.images) : [],
      price: Number(p.price),
      cost_price: Number(p.cost_price),
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/products — create product
router.post('/', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, category, price, cost_price, sizes, colors, stock, description, images } = req.body;

    if (!name || !sku) {
      res.status(400).json({ message: '名称和编号不能为空' });
      return;
    }

    // Check SKU uniqueness
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      res.status(409).json({ message: '商品编号已存在' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO products (name, sku, category, price, cost_price, sizes, colors, stock, description, images, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online')`,
      [
        name,
        sku,
        category || null,
        price || 0,
        cost_price || 0,
        sizes ? JSON.stringify(sizes) : null,
        colors ? JSON.stringify(colors) : null,
        stock || 0,
        description || null,
        images ? JSON.stringify(images) : null,
      ]
    );

    const [created] = await pool.execute<RowDataPacket[]>('SELECT * FROM products WHERE id = ?', [result.insertId]);
    const p = created[0] as any;
    res.status(201).json({
      ...p,
      sizes: p.sizes ? safeParseJSON(p.sizes) : [],
      colors: p.colors ? safeParseJSON(p.colors) : [],
      images: p.images ? safeParseJSON(p.images) : [],
      price: Number(p.price),
      cost_price: Number(p.cost_price),
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/products/:id — update product
router.put('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, category, price, cost_price, sizes, colors, stock, description, images, status } = req.body;

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM products WHERE id = ?",
      [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ message: '商品不存在' });
      return;
    }

    // If SKU changed, check uniqueness
    if (sku && sku !== (existing[0] as any).sku) {
      const [dup] = await pool.execute<RowDataPacket[]>('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, req.params.id]);
      if (dup.length > 0) {
        res.status(409).json({ message: '商品编号已存在' });
        return;
      }
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE products SET
        name = ?, sku = ?, category = ?, price = ?, cost_price = ?,
        sizes = ?, colors = ?, stock = ?, description = ?, images = ?,
        status = ?
       WHERE id = ?`,
      [
        name || (existing[0] as any).name,
        sku || (existing[0] as any).sku,
        category !== undefined ? category : (existing[0] as any).category,
        price ?? (existing[0] as any).price,
        cost_price ?? (existing[0] as any).cost_price,
        sizes ? JSON.stringify(sizes) : (existing[0] as any).sizes,
        colors ? JSON.stringify(colors) : (existing[0] as any).colors,
        stock ?? (existing[0] as any).stock,
        description !== undefined ? description : (existing[0] as any).description,
        images ? JSON.stringify(images) : (existing[0] as any).images,
        status || (existing[0] as any).status,
        req.params.id,
      ]
    );

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM products WHERE id = ?', [req.params.id]);
    const p = updated[0] as any;
    res.json({
      ...p,
      sizes: p.sizes ? safeParseJSON(p.sizes) : [],
      colors: p.colors ? safeParseJSON(p.colors) : [],
      images: p.images ? safeParseJSON(p.images) : [],
      price: Number(p.price),
      cost_price: Number(p.cost_price),
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/products/:id — hard delete with ID resequence
router.delete('/:id', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      res.status(404).json({ message: '商品不存在' });
      return;
    }

    await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    await resequenceIds();
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/products/batch — batch operations
router.post('/batch', authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, action } = req.body; // action: 'online' | 'offline' | 'delete'

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: '请选择商品' });
      return;
    }

    if (!['online', 'offline', 'delete'].includes(action)) {
      res.status(400).json({ message: '无效操作' });
      return;
    }

    const placeholders = ids.map(() => '?').join(',');

    if (action === 'delete') {
      await pool.execute(
        `DELETE FROM products WHERE id IN (${placeholders})`,
        ids
      );
      await resequenceIds();
    } else {
      await pool.execute(
        `UPDATE products SET status = ? WHERE id IN (${placeholders})`,
        [action, ...ids]
      );
    }

    res.json({ message: `已${action === 'online' ? '上架' : action === 'offline' ? '下架' : '删除'} ${ids.length} 个商品` });
  } catch (error) {
    console.error('Batch operation error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

async function resequenceIds() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET @row_num = 0');
    await conn.query('UPDATE products SET id = (@row_num := @row_num + 1) ORDER BY id');
    await conn.query('ALTER TABLE products AUTO_INCREMENT = 1');
  } finally {
    conn.release();
  }
}

function safeParseJSON(str: string) {
  try {
    if (Array.isArray(str)) return str;
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default router;
