import { Request } from 'express';

export interface User {
  id: number;
  username: string;
  password: string;
  email: string | null;
  nickname: string | null;
  role: 'admin' | 'manager' | 'artist' | 'user';
  status: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithoutPassword {
  id: number;
  username: string;
  email: string | null;
  nickname: string | null;
  role: string;
  status: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
