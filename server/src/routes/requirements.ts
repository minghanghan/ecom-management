import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

router.use(authenticate);

// GET /api/requirements — list with pagination
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;
    const status = req.query.status as string | undefined;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    // Non-admin users only see their own requirements
    if (req.user?.role !== 'admin') {
      conditions.push('r.created_by = ?');
      params.push(req.user!.userId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM requirements r ${where}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.nickname as creator_name, a.nickname as assignee_name, s.name as store_name
       FROM requirements r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN users a ON r.assignee_id = a.id
       LEFT JOIN stores s ON r.store_id = s.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, String(pageSize), String(offset)]
    );

    const items = (rows as any[]).map((r) => ({
      ...r,
      links: parseLinks(r.links),
    }));

    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Requirements list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/requirements/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.nickname as creator_name, s.name as store_name
       FROM requirements r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN stores s ON r.store_id = s.id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: '需求不存在' });
      return;
    }
    const r = rows[0] as any;
    res.json({
      ...r,
      links: parseLinks(r.links),
    });
  } catch (error) {
    console.error('Requirement detail error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/requirements — create
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { product_name, product_sku, links, description, priority, store_id } = req.body;

    if (!product_name || !product_sku) {
      res.status(400).json({ message: '商品名称和编号不能为空' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO requirements (product_name, product_sku, links, description, priority, store_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product_name,
        product_sku,
        links && Array.isArray(links) ? JSON.stringify(links) : null,
        description || null,
        priority || 'medium',
        store_id || null,
        req.user!.userId,
      ]
    );

    const [created] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, s.name as store_name FROM requirements r LEFT JOIN stores s ON r.store_id = s.id WHERE r.id = ?`,
      [result.insertId]
    );
    const r = created[0] as any;
    res.status(201).json({
      ...r,
      links: parseLinks(r.links),
    });
  } catch (error) {
    console.error('Create requirement error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/requirements/:id — update (only when pending)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM requirements WHERE id = ?',
      [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ message: '需求不存在' });
      return;
    }

    const r = existing[0] as any;

    // Only admin or creator can edit, and only when pending
    if (req.user?.role !== 'admin' && r.created_by !== req.user!.userId) {
      res.status(403).json({ message: '无权操作' });
      return;
    }
    if (r.status !== 'pending') {
      res.status(400).json({ message: '仅待处理状态可编辑' });
      return;
    }

    const { product_name, product_sku, links, description, priority, store_id } = req.body;

    await pool.execute(
      `UPDATE requirements SET
        product_name = ?, product_sku = ?, links = ?, description = ?, priority = ?, store_id = ?
       WHERE id = ?`,
      [
        product_name || r.product_name,
        product_sku || r.product_sku,
        links !== undefined ? JSON.stringify(links) : r.links,
        description !== undefined ? description : r.description,
        priority || r.priority,
        store_id !== undefined ? store_id : r.store_id,
        req.params.id,
      ]
    );

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM requirements WHERE id = ?', [req.params.id]);
    const u = updated[0] as any;
    res.json({
      ...u,
      links: parseLinks(u.links),
    });
  } catch (error) {
    console.error('Update requirement error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/requirements/:id — hard delete (only when pending)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM requirements WHERE id = ?',
      [req.params.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ message: '需求不存在' });
      return;
    }

    const r = existing[0] as any;

    if (req.user?.role !== 'admin' && r.created_by !== req.user!.userId) {
      res.status(403).json({ message: '无权操作' });
      return;
    }
    if (r.status !== 'pending') {
      res.status(400).json({ message: '仅待处理状态可删除' });
      return;
    }

    await pool.execute('DELETE FROM requirements WHERE id = ?', [req.params.id]);
    res.json({ message: '已删除' });
  } catch (error) {
    console.error('Delete requirement error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

function parseLinks(links: any): string[] {
  if (Array.isArray(links)) return links;
  if (typeof links === 'string') {
    try {
      const parsed = JSON.parse(links);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default router;
