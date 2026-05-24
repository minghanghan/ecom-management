import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

router.use(authenticate);

// Allow access if user is admin, has role 'artist', or has artist_task_view permission
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'artist' || req.user?.permissions?.artist_task_view) {
    return next();
  }
  res.status(403).json({ message: '无权限访问' });
});

const PRIORITY_ORDER = "FIELD(r.priority, 'urgent', 'high', 'medium', 'low')";

// GET /api/artist-tasks — list tasks sorted by priority then time
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const storeId = req.query.store_id as string | undefined;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (storeId) {
      conditions.push('r.store_id = ?');
      params.push(Number(storeId));
    }

    // artist sees: unassigned pending tasks + their own tasks; admin sees all
    if (req.user?.role !== 'admin') {
      conditions.push('(r.assignee_id = ? OR (r.status = ? AND r.assignee_id IS NULL))');
      params.push(req.user!.userId, 'pending');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.nickname as creator_name, a.nickname as assignee_name, s.name as store_name
       FROM requirements r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN users a ON r.assignee_id = a.id
       LEFT JOIN stores s ON r.store_id = s.id
       ${where}
       ORDER BY ${PRIORITY_ORDER}, r.created_at DESC`,
      params
    );

    const items = (rows as any[]).map((r) => ({
      ...r,
      links: parseLinks(r.links),
      completion_files: r.completion_files ? parseLinks(r.completion_files) : [],
      artist_completed: Number(r.artist_completed),
    }));

    // Counts for filter tabs (always unfiltered by status)
    const countConditions: string[] = [];
    const countParams: any[] = [];
    if (storeId) {
      countConditions.push('r.store_id = ?');
      countParams.push(Number(storeId));
    }
    if (req.user?.role !== 'admin') {
      countConditions.push('(r.assignee_id = ? OR (r.status = ? AND r.assignee_id IS NULL))');
      countParams.push(req.user!.userId, 'pending');
    }
    const countWhere = countConditions.length ? `WHERE ${countConditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.status, COUNT(*) as cnt FROM requirements r ${countWhere} GROUP BY r.status`,
      countParams
    );
    const counts = { pending: 0, in_progress: 0, completed: 0 };
    for (const row of countRows as any[]) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = row.cnt;
    }

    res.json({ items, counts });
  } catch (error) {
    console.error('Artist tasks list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/artist-tasks/:id/claim — claim a task
router.post('/:id/claim', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ message: '无效ID' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM requirements WHERE id = ? AND status = 'pending' AND assignee_id IS NULL",
      [id]
    );
    if (existing.length === 0) {
      res.status(400).json({ message: '任务不存在或已被认领' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE requirements SET assignee_id = ?, status = 'in_progress', claimed_at = NOW() WHERE id = ?`,
      [req.user!.userId, id]
    );

    if (result.affectedRows === 0) {
      res.status(400).json({ message: '认领失败' });
      return;
    }

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM requirements WHERE id = ?', [id]);
    const r = updated[0] as any;
    res.json({
      ...r,
      links: parseLinks(r.links),
      completion_files: r.completion_files ? parseLinks(r.completion_files) : [],
      artist_completed: Number(r.artist_completed),
    });
  } catch (error) {
    console.error('Claim task error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/artist-tasks/:id/files — save uploaded file URLs
router.post('/:id/files', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ message: '无效ID' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM requirements WHERE id = ? AND status = 'in_progress'",
      [id]
    );
    if (existing.length === 0) {
      res.status(400).json({ message: '任务不存在或未在处理中' });
      return;
    }

    const r = existing[0] as any;
    if (req.user?.role !== 'admin' && r.assignee_id !== req.user!.userId) {
      res.status(403).json({ message: '无权操作' });
      return;
    }

    const { files } = req.body; // string[]
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ message: '请提供文件URL' });
      return;
    }

    const existingFiles = r.completion_files ? parseLinks(r.completion_files) : [];
    const merged = [...existingFiles, ...files];

    await pool.execute('UPDATE requirements SET completion_files = ? WHERE id = ?', [
      JSON.stringify(merged), id
    ]);

    res.json({ files: merged });
  } catch (error) {
    console.error('Save task files error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/artist-tasks/:id/file-path — update file path (any status)
router.put('/:id/file-path', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ message: '无效ID' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM requirements WHERE id = ?', [id]
    );
    if (existing.length === 0) {
      res.status(404).json({ message: '任务不存在' });
      return;
    }

    const r = existing[0] as any;
    if (req.user?.role !== 'admin' && r.assignee_id !== req.user!.userId) {
      res.status(403).json({ message: '无权操作' });
      return;
    }

    const { file_url } = req.body;
    if (!file_url || typeof file_url !== 'string') {
      res.status(400).json({ message: '请提供文件路径' });
      return;
    }

    await pool.execute('UPDATE requirements SET completion_files = ? WHERE id = ?', [
      JSON.stringify([file_url]), id
    ]);

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update file path error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/artist-tasks/:id/complete — mark task as complete
router.put('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ message: '无效ID' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM requirements WHERE id = ? AND status = 'in_progress'",
      [id]
    );
    if (existing.length === 0) {
      res.status(400).json({ message: '任务不存在或未在处理中' });
      return;
    }

    const r = existing[0] as any;
    if (req.user?.role !== 'admin' && r.assignee_id !== req.user!.userId) {
      res.status(403).json({ message: '无权操作' });
      return;
    }

    const { file_url } = req.body;

    const sets = ["artist_completed = 1", "status = 'completed'"];
    const params: any[] = [];

    if (file_url && typeof file_url === 'string') {
      sets.push("completion_files = ?");
      params.push(JSON.stringify([file_url]));
    }

    params.push(id);
    await pool.execute(
      `UPDATE requirements SET ${sets.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM requirements WHERE id = ?', [id]);
    const u = updated[0] as any;
    res.json({
      ...u,
      links: parseLinks(u.links),
      completion_files: u.completion_files ? parseLinks(u.completion_files) : [],
      artist_completed: Number(u.artist_completed),
    });
  } catch (error) {
    console.error('Complete task error:', error);
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
