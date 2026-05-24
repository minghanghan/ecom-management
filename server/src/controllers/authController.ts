import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { config } from '../config';
import { AuthRequest, User, UserWithoutPassword } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

function stripPassword(user: User): UserWithoutPassword {
  const { password, ...rest } = user;
  return { ...rest, permissions: {} };
}

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(req: AuthRequest, res: Response) {
  try {
    const { username, password, email, nickname } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: '手机号和密码不能为空' });
      return;
    }

    // Validate phone number
    if (!PHONE_REGEX.test(username)) {
      res.status(400).json({ message: '请输入正确的11位手机号' });
      return;
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      res.status(400).json({ message: '密码需8-20位，包含大小写字母和数字' });
      return;
    }

    // Validate email format if provided
    if (email && !EMAIL_REGEX.test(email)) {
      res.status(400).json({ message: '邮箱格式不正确' });
      return;
    }

    // Check if user exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      res.status(409).json({ message: '该手机号已注册' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (username, password, email, nickname, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, email || null, nickname || null, 'user']
    );

    const [users] = await pool.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = users[0] as User;

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, store_id: null, role_id: null, permissions: {} },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
      sameSite: 'lax',
    });

    res.status(201).json({ user: stripPassword(user), message: '注册成功' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}

export async function seedAdmin() {
  const username = '18186754356';
  const password = 'Hmh858789370!';

  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );

  if (existing.length === 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute<ResultSetHeader>(
      'INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, '超级管理员', 'admin']
    );
    console.log('Default admin account created');
  } else {
    console.log('Default admin account already exists');
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: '用户名和密码不能为空' });
      return;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      res.status(401).json({ message: '用户名或密码错误' });
      return;
    }

    const user = rows[0] as User;

    if (user.status === 0) {
      res.status(403).json({ message: '账户已被禁用' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: '用户名或密码错误' });
      return;
    }

    // Update last login time
    await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // Load permissions and role name from custom role
    let permissions: Record<string, boolean> = {};
    let role_name: string | null = null;
    if (user.role === 'admin') {
      // Admin has all permissions
      const { PERMISSION_DEFS } = await import('../types');
      PERMISSION_DEFS.forEach((p: any) => { permissions[p.key] = true; });
    } else if (user.role_id) {
      const [roleRows] = await pool.execute<RowDataPacket[]>(
        'SELECT permissions, name FROM roles WHERE id = ?', [user.role_id]
      );
      if (roleRows.length > 0) {
        const raw = roleRows[0].permissions;
        permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
        role_name = roleRows[0].name;
      }
    }

    const tokenPayload = {
      userId: user.id, username: user.username, role: user.role,
      store_id: user.store_id, role_id: user.role_id,
      permissions,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 15 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({
      user: { ...stripPassword(user), permissions, role_name, last_login_at: new Date().toISOString() },
      message: '登录成功',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [req.user!.userId]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: '用户不存在' });
      return;
    }
    const user = rows[0] as User;

    // Always load fresh permissions from database (not from JWT)
    let permissions: Record<string, boolean> = {};
    let role_name: string | null = null;

    if (user.role === 'admin') {
      const { PERMISSION_DEFS } = await import('../types');
      PERMISSION_DEFS.forEach((p: any) => { permissions[p.key] = true; });
    } else if (user.role_id) {
      const [roleRows] = await pool.execute<RowDataPacket[]>(
        'SELECT permissions, name FROM roles WHERE id = ?', [user.role_id]
      );
      if (roleRows.length > 0) {
        const raw = roleRows[0].permissions;
        permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
        role_name = roleRows[0].name;
      }
    }

    // Also refresh the JWT token so backend route guards use updated permissions
    const tokenPayload = {
      userId: user.id, username: user.username, role: user.role,
      store_id: user.store_id, role_id: user.role_id,
      permissions,
    };
    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 15 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({ user: { ...stripPassword(user), permissions, role_name } });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}

export async function logout(_req: AuthRequest, res: Response) {
  res.clearCookie('token');
  res.json({ message: '已退出登录' });
}
