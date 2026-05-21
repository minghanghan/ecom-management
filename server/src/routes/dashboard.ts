import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

const router = Router();

// GET /api/dashboard/summary - overview cards
router.get('/summary', authenticate, async (_req: Request, res: Response) => {
  try {
    const [productRow] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM products');
    const [orderRow] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as total FROM orders WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')");
    const [refundRow] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as total FROM order_refunds WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')");
    const [incomeRow] = await pool.execute<RowDataPacket[]>(
      "SELECT COALESCE(SUM(actual_price), 0) as total FROM orders WHERE status IN ('completed','shipped') AND DATE_FORMAT(payment_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')"
    );
    const [refundAmountRow] = await pool.execute<RowDataPacket[]>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM order_refunds WHERE status = 'completed' AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')"
    );

    res.json({
      totalProducts: productRow[0].total,
      monthlyOrders: orderRow[0].total,
      monthlyRefunds: refundRow[0].total,
      monthlyIncome: Number(incomeRow[0].total),
      monthlyRefundAmount: Number(refundAmountRow[0].total),
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/dashboard/charts - all chart data
router.get('/charts', authenticate, async (_req: Request, res: Response) => {
  try {
    // 1. Order trend - last 30 days
    const [orderTrend] = await pool.execute<RowDataPacket[]>(`
      SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(actual_price), 0) as amount
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // 2. Category distribution
    const [categoryDist] = await pool.execute<RowDataPacket[]>(`
      SELECT p.category, COUNT(*) as count
      FROM orders o
      JOIN products p ON o.product_id = p.id
      GROUP BY p.category
      ORDER BY count DESC
    `);

    // 3. Order status distribution
    const [statusDist] = await pool.execute<RowDataPacket[]>(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `);

    // 4. Refund trend - last 30 days
    const [refundTrend] = await pool.execute<RowDataPacket[]>(`
      SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM order_refunds
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // 5. Income vs expense - last 30 days
    const [incomeExpense] = await pool.execute<RowDataPacket[]>(`
      SELECT DATE(record_date) as date,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type IN ('expense','refund','fee') THEN amount ELSE 0 END), 0) as expense
      FROM finance_records
      WHERE record_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(record_date)
      ORDER BY date
    `);

    res.json({
      orderTrend,
      categoryDist,
      statusDist,
      refundTrend,
      incomeExpense,
    });
  } catch (error) {
    console.error('Dashboard charts error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
