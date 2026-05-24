import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket } from 'mysql2';

const router = Router();

router.use(authenticate);

// Allow access if user is admin or has role 'user' or has deploy_task_view permission
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'user' || req.user?.permissions?.deploy_task_view) {
    return next();
  }
  res.status(403).json({ message: '无权限访问' });
});

// GET /api/deploy-links — list tasks where artist_completed = 1
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const storeId = req.query.store_id as string | undefined;
    const conditions: string[] = ['r.artist_completed = 1'];
    const params: any[] = [];

    if (status === 'pending') {
      conditions.push('r.deploy_completed = 0');
    } else if (status === 'deployed') {
      conditions.push('r.deploy_completed = 1');
    }

    if (storeId) {
      conditions.push('r.store_id = ?');
      params.push(Number(storeId));
    }

    // Non-admin users only see their own requirements
    if (req.user?.role !== 'admin') {
      conditions.push('r.created_by = ?');
      params.push(req.user!.userId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.nickname as creator_name, a.nickname as assignee_name, s.name as store_name
       FROM requirements r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN users a ON r.assignee_id = a.id
       LEFT JOIN stores s ON r.store_id = s.id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );

    const items = (rows as any[]).map((r) => ({
      ...r,
      links: parseLinks(r.links),
      completion_files: r.completion_files ? parseLinks(r.completion_files) : [],
      artist_completed: Number(r.artist_completed),
      deploy_completed: Number(r.deploy_completed),
    }));

    // Counts for filter tabs (unfiltered by deploy status)
    const countConditions: string[] = ['r.artist_completed = 1'];
    const countParams: any[] = [];
    if (storeId) {
      countConditions.push('r.store_id = ?');
      countParams.push(Number(storeId));
    }
    if (req.user?.role !== 'admin') {
      countConditions.push('r.created_by = ?');
      countParams.push(req.user!.userId);
    }
    const countWhere = countConditions.length ? `WHERE ${countConditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.deploy_completed, COUNT(*) as cnt FROM requirements r ${countWhere} GROUP BY r.deploy_completed`,
      countParams
    );
    const counts = { pending: 0, deployed: 0 };
    for (const row of countRows as any[]) {
      if (row.deploy_completed === 0) counts.pending = row.cnt;
      else if (row.deploy_completed === 1) counts.deployed = row.cnt;
    }

    res.json({ items, counts });
  } catch (error) {
    console.error('Deploy links list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/deploy-links/:id/complete — mark as deployed
router.put('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ message: '无效ID' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM requirements WHERE id = ? AND artist_completed = 1",
      [id]
    );
    if (existing.length === 0) {
      res.status(400).json({ message: '任务不存在或美工师尚未完成' });
      return;
    }

    const r = existing[0] as any;
    if (req.user?.role !== 'admin' && r.created_by !== req.user!.userId) {
      res.status(403).json({ message: '无权操作' });
      return;
    }

    const { deploy_link } = req.body;
    if (!deploy_link || typeof deploy_link !== 'string' || !deploy_link.trim()) {
      res.status(400).json({ message: '请提供布置链接' });
      return;
    }

    await pool.execute(
      'UPDATE requirements SET deploy_completed = 1, deploy_link = ? WHERE id = ?',
      [deploy_link.trim(), id]
    );

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM requirements WHERE id = ?', [id]);
    const u = updated[0] as any;
    res.json({
      ...u,
      links: parseLinks(u.links),
      completion_files: u.completion_files ? parseLinks(u.completion_files) : [],
      artist_completed: Number(u.artist_completed),
      deploy_completed: Number(u.deploy_completed),
    });
  } catch (error) {
    console.error('Deploy complete error:', error);
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
