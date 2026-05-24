import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import requirementRoutes from './routes/requirements';
import artistTaskRoutes from './routes/artistTasks';
import { seedAdmin } from './controllers/authController';
import { initDatabase } from './config/database';
import { config } from './config';

dotenv.config();

const app = express();

app.use(cors({
  origin: true, // allow all origins in dev
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(process.cwd(), 'data', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/artist-tasks', artistTaskRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await initDatabase();
    await seedAdmin();
    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
