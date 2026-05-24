import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { RowDataPacket } from 'mysql2';

const router = Router();

function getStoreCondition(req: AuthRequest): { sql: string; params: any[] } {
  const storeId = req.query.store_id as string || (req.user?.store_id ? String(req.user.store_id) : undefined);
  if (storeId) {
    return { sql: 'AND store_id = ?', params: [storeId] };
  }
  return { sql: '', params: [] };
}

// GET /api/dashboard/summary
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sql: storeSql, params: storeParams } = getStoreCondition(req);

    const [productRow] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM products`
    );

    const [orderRow] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM orders WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') ${storeSql}`,
      storeParams
    );

    const [incomeRow] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(actual_amount), 0) as total FROM orders WHERE status IN ('completed','delivered') AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') ${storeSql}`,
      storeParams
    );

    // Refunding orders (instead of order_refunds table)
    const [refundRow] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM orders WHERE refund_status = 'refunding' ${storeSql}`,
      storeParams
    );

    res.json({
      totalProducts: productRow[0].total,
      monthlyOrders: orderRow[0].total,
      monthlyIncome: Number(incomeRow[0].total),
      monthlyRefunds: refundRow[0].total,
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/dashboard/charts
router.get('/charts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sql: storeSql, params: storeParams } = getStoreCondition(req);

    const [orderTrend] = await pool.execute<RowDataPacket[]>(
      `SELECT DATE(order_date) as date, COUNT(*) as count, COALESCE(SUM(actual_amount), 0) as amount
       FROM orders
       WHERE order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${storeSql}
       GROUP BY DATE(order_date)
       ORDER BY date`,
      storeParams
    );

    const [statusDist] = await pool.execute<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM orders ${storeSql ? `WHERE ${storeSql.replace('AND ', '')}` : ''}
       GROUP BY status`,
      storeParams
    );

    // Order trend by platform
    const [platformDist] = await pool.execute<RowDataPacket[]>(
      `SELECT platform, COUNT(*) as count, COALESCE(SUM(actual_amount), 0) as amount
       FROM orders ${storeSql ? `WHERE ${storeSql.replace('AND ', '')}` : ''}
       GROUP BY platform
       ORDER BY count DESC`,
      storeParams
    );

    res.json({ orderTrend, statusDist, platformDist });
  } catch (error) {
    console.error('Dashboard charts error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
