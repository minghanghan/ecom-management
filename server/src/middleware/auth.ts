import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { config } from '../config';
import { JwtPayload, AuthRequest } from '../types';
import { RowDataPacket } from 'mysql2';

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ message: '未登录，请先登录' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: '未登录' });
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403).json({ message: '无权限访问' });
      return;
    }
    next();
  };
}

export function requirePermission(perm: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: '未登录' });
      return;
    }
    if (req.user.role === 'admin') {
      next();
      return;
    }
    if (req.user.permissions?.[perm]) {
      next();
      return;
    }
    res.status(403).json({ message: '无此操作权限' });
  };
}

export async function loadUserPermissions(userId: number): Promise<Record<string, boolean>> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.permissions FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );
    if (rows.length > 0 && rows[0].permissions) {
      if (typeof rows[0].permissions === 'string') {
        return JSON.parse(rows[0].permissions);
      }
      return rows[0].permissions;
    }
  } catch (_e) { /* fall through */ }
  return {};
}
