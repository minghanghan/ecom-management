import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

router.use(authenticate);

// ─── SSE (Server-Sent Events) ─────────────────────────

// Store active SSE connections: userId -> Response[]
const sseClients = new Map<number, Response[]>();

function addSSEClient(userId: number, res: Response) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, []);
  }
  sseClients.get(userId)!.push(res);
}

function removeSSEClient(userId: number, res: Response) {
  const clients = sseClients.get(userId);
  if (!clients) return;
  const idx = clients.indexOf(res);
  if (idx !== -1) clients.splice(idx, 1);
  if (clients.length === 0) sseClients.delete(userId);
}

function notifyUser(userId: number) {
  const clients = sseClients.get(userId);
  if (!clients) return;
  const data = `event: new_message\ndata: {}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch { /* connection may be dead */ }
  }
}

function notifyAllAdmins() {
  for (const [userId, clients] of sseClients.entries()) {
    // We don't know which users are admins from just the userId,
    // so we send to all — the frontend will ignore if not applicable
    const data = `event: new_message\ndata: {}\n\n`;
    for (const res of clients) {
      try { res.write(data); } catch { /* ignore */ }
    }
  }
}

// GET /api/chat/events — establish SSE connection
router.get('/events', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send initial connection event
  res.write(`event: connected\ndata: {}\n\n`);

  // Register client
  addSSEClient(userId, res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(`:heartbeat\n\n`); } catch { /* ignore */ }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(userId, res);
  });
});

// POST /api/chat/send — send a message
router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    const { message, receiver_id } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ message: '消息不能为空' });
      return;
    }

    // Non-admin users send messages to admin (receiver_id = NULL)
    // Admin users send messages to a specific user (receiver_id = user ID)
    const actualReceiver = req.user!.role === 'admin' ? (receiver_id || null) : null;

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [req.user!.userId, actualReceiver, message.trim()]
    );

    const [created] = await pool.execute<RowDataPacket[]>(
      `SELECT cm.*, u.nickname as sender_name
       FROM chat_messages cm
       LEFT JOIN users u ON cm.sender_id = u.id
       WHERE cm.id = ?`,
      [result.insertId]
    );

    res.status(201).json(created[0]);

    // Notify via SSE: if message has a specific receiver, notify them
    if (actualReceiver) {
      notifyUser(actualReceiver);
    } else {
      // User → admin: notify all connected admins
      notifyAllAdmins();
    }
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ message: '发送失败' });
  }
});

// GET /api/chat/messages — get messages for the current user or between admin and a user
router.get('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    if (req.user!.role === 'admin') {
      // Admin: get messages with a specific user
      const otherUserId = req.query.user_id as string;
      if (!otherUserId) {
        res.status(400).json({ message: '请指定用户ID' });
        return;
      }
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT cm.*, u.nickname as sender_name
         FROM chat_messages cm
         LEFT JOIN users u ON cm.sender_id = u.id
         WHERE (cm.sender_id = ? AND cm.receiver_id IS NULL)
            OR (cm.sender_id = ? AND cm.receiver_id = ?)
         ORDER BY cm.created_at ASC`,
        [Number(otherUserId), userId, Number(otherUserId)]
      );
      res.json(rows);
    } else {
      // Regular user: get their messages + admin replies
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT cm.*, u.nickname as sender_name
         FROM chat_messages cm
         LEFT JOIN users u ON cm.sender_id = u.id
         WHERE (cm.sender_id = ? AND cm.receiver_id IS NULL)
            OR (cm.receiver_id = ?)
         ORDER BY cm.created_at ASC`,
        [userId, userId]
      );
      res.json(rows);
    }
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: '获取消息失败' });
  }
});

// GET /api/chat/conversations — admin only: list all users with message history
router.get('/conversations', authorize('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.nickname,
              COUNT(CASE WHEN cm.is_read = 0 AND cm.sender_id = u.id THEN 1 END) as unread_count,
              MAX(cm.created_at) as last_message_at
       FROM users u
       INNER JOIN chat_messages cm ON (cm.sender_id = u.id OR cm.receiver_id = u.id)
       WHERE u.role != 'admin'
       GROUP BY u.id
       ORDER BY last_message_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: '获取会话列表失败' });
  }
});

// PUT /api/chat/read/:userId — admin only: mark messages from a user as read
router.put('/read/:userId', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await pool.execute(
      'UPDATE chat_messages SET is_read = 1 WHERE sender_id = ? AND is_read = 0',
      [req.params.userId]
    );
    res.json({ message: '已标记为已读' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: '操作失败' });
  }
});

// PUT /api/chat/read-mine — mark messages sent TO me as read (for regular users)
router.put('/read-mine', async (req: AuthRequest, res: Response) => {
  try {
    await pool.execute(
      'UPDATE chat_messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0',
      [req.user!.userId]
    );
    res.json({ message: '已标记为已读' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: '操作失败' });
  }
});

// GET /api/chat/unread — get unread message count for current user
router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    if (req.user!.role === 'admin') {
      // Admin: count messages from non-admin users that are unread
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM chat_messages cm
         JOIN users u ON cm.sender_id = u.id
         WHERE u.role != 'admin' AND cm.is_read = 0`
      );
      res.json({ count: rows[0].count });
    } else {
      // Regular user: count unread admin replies (receiver_id = this user)
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM chat_messages
         WHERE receiver_id = ? AND is_read = 0`,
        [userId]
      );
      res.json({ count: rows[0].count });
    }
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: '获取未读数失败' });
  }
});

export default router;
