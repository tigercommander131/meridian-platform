import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/environment.js';
import { testConnection } from './config/database.js';
import authRouter from './routes/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.nodeEnv });
});

// Routes
app.use('/api/auth', authRouter);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

async function start() {
  // DB connection optional on Day 1 — don't block server start
  await testConnection();

  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv}`);
  });
}

start();
