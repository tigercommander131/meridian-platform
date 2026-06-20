import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/environment.js';
import authRouter from './routes/auth.js';
import syncRouter from './routes/sync.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Express app, no listener — imported by server.js (runtime) and tests (supertest).
export function createApp() {
  const app = express();

  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  if (config.nodeEnv !== 'test') app.use(morgan('dev'));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.nodeEnv });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/sync', syncRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
