import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest, PERMISSION_DEFS } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

router.use(authenticate);

// ──────── User Management ────────────────────────────────

// GET /api/admin/users
router.get('/users', authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.nickname, u.role, u.store_id, u.role_id, u.status,
              u.last_login_at, u.created_at,
              s.name as store_name, r.name as role_name
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.id`
    );
    res.json(rows);
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/admin/users
router.post('/users', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, nickname, role, store_id, role_id } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: '用户名和密码不能为空' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?', [username]
    );
    if (existing.length > 0) {
      res.status(409).json({ message: '用户名已存在' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (username, password, email, nickname, role, store_id, role_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, email || null, nickname || null, role || 'user', store_id || null, role_id || null]
    );

    const [created] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, s.name as store_name, r.name as role_name
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`, [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, nickname, role, store_id, role_id, status } = req.body;
    const sets: string[] = [];
    const params: any[] = [];

    if (username !== undefined) { sets.push('username = ?'); params.push(username); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }
    if (nickname !== undefined) { sets.push('nickname = ?'); params.push(nickname); }
    if (role !== undefined) { sets.push('role = ?'); params.push(role); }
    if (store_id !== undefined) { sets.push('store_id = ?'); params.push(store_id); }
    if (role_id !== undefined) { sets.push('role_id = ?'); params.push(role_id); }
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      sets.push('password = ?');
      params.push(hashed);
    }

    if (!sets.length) {
      res.status(400).json({ message: '没有要更新的字段' });
      return;
    }

    params.push(req.params.id);
    await pool.execute<ResultSetHeader>(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, s.name as store_name, r.name as role_name
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`, [req.params.id]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '用户不存在' });
      return;
    }
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ──────── Role Management ───────────────────────────────

// GET /api/admin/roles
router.get('/roles', authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles ORDER BY id');
    const parsed = (rows as any[]).map((r) => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions,
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Roles list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/admin/roles
router.post('/roles', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) {
      res.status(400).json({ message: '角色名称不能为空' });
      return;
    }

    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE name = ?', [name]);
    if (existing.length > 0) {
      res.status(409).json({ message: '角色名已存在' });
      return;
    }

    const perms = typeof permissions === 'object' ? JSON.stringify(permissions) : permissions || '{}';
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)',
      [name, description || '', perms]
    );

    const [created] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/admin/roles/:id
router.put('/roles/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, permissions } = req.body;

    const [existing] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '角色不存在' });
      return;
    }

    if ((existing[0] as any).is_system && name !== (existing[0] as any).name) {
      res.status(400).json({ message: '系统角色不可重命名' });
      return;
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (permissions !== undefined) {
      sets.push('permissions = ?');
      params.push(typeof permissions === 'string' ? permissions : JSON.stringify(permissions));
    }
    params.push(req.params.id);
    await pool.execute<ResultSetHeader>(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/admin/roles/:id
router.delete('/roles/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '角色不存在' });
      return;
    }
    if ((existing[0] as any).is_system) {
      res.status(400).json({ message: '系统角色不可删除' });
      return;
    }
    await pool.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/admin/permissions — list all permission defs
router.get('/permissions', authorize('admin'), (_req: AuthRequest, res: Response) => {
  res.json(PERMISSION_DEFS);
});

// ──────── Store Management ──────────────────────────────

// GET /api/admin/stores
router.get('/stores', authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM stores ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('Stores list error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/admin/stores/active — active stores for selection
router.get('/stores/active', async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, code, platform FROM stores WHERE status = 1 ORDER BY id"
    );
    res.json(rows);
  } catch (error) {
    console.error('Active stores error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/admin/stores
router.post('/stores', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, platform, remark } = req.body;
    if (!name || !code) {
      res.status(400).json({ message: '店铺名称和代码不能为空' });
      return;
    }

    // Auto-generate code from name pinyin initials if not provided
    // For now we just validate uniqueness
    const [existingName] = await pool.execute<RowDataPacket[]>('SELECT id FROM stores WHERE name = ?', [name]);
    if (existingName.length > 0) {
      res.status(409).json({ message: '店铺名已存在' });
      return;
    }
    const [existingCode] = await pool.execute<RowDataPacket[]>('SELECT id FROM stores WHERE code = ?', [code]);
    if (existingCode.length > 0) {
      res.status(409).json({ message: '店铺代码已存在' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO stores (name, code, platform, remark) VALUES (?, ?, ?, ?)',
      [name, code, platform || '', remark || '']
    );
    const [created] = await pool.execute<RowDataPacket[]>('SELECT * FROM stores WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PUT /api/admin/stores/:id
router.put('/stores/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, platform, status, remark } = req.body;
    const sets: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (code !== undefined) { sets.push('code = ?'); params.push(code); }
    if (platform !== undefined) { sets.push('platform = ?'); params.push(platform); }
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (remark !== undefined) { sets.push('remark = ?'); params.push(remark); }

    if (!sets.length) {
      res.status(400).json({ message: '没有要更新的字段' });
      return;
    }
    params.push(req.params.id);
    await pool.execute<ResultSetHeader>(`UPDATE stores SET ${sets.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.execute<RowDataPacket[]>('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/admin/stores/:id
router.delete('/stores/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM stores WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      res.status(404).json({ message: '店铺不存在' });
      return;
    }
    await pool.execute('DELETE FROM stores WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
