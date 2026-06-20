import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/environment.js';
import authRouter from './routes/auth.js';
import syncRouter from './routes/sync.js';
import organisationsRouter from './routes/organisations.js';
import cohortsRouter from './routes/cohorts.js';
import sessionsRouter from './routes/sessions.js';
import rubricsRouter from './routes/rubrics.js';
import reportsRouter from './routes/reports.js';
import studentRouter from './routes/student.js';
import certificatesRouter from './routes/certificates.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Express app, no listener — imported by server.js (runtime) and tests (supertest).
export function createApp() {
  const app = express();

  // Behind Railway's proxy: trust it so req.ip / rate-limiting see the real
  // client address rather than the proxy's.
  app.set('trust proxy', 1);

  // Security headers. crossOriginResourcePolicy relaxed so the separate
  // frontend origin can call this API.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Allowed origins: localhost for dev + anything in CORS_ORIGIN (comma-separated)
  // for deployed frontends. Set CORS_ORIGIN=https://your-app.up.railway.app in prod.
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : []),
  ];
  app.use(cors({
    origin(origin, cb) {
      // Allow same-origin/non-browser requests (no Origin header) and any listed origin.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
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
  app.use('/api/organisations', organisationsRouter);
  app.use('/api/rubrics', rubricsRouter);
  app.use('/api', cohortsRouter);
  app.use('/api', sessionsRouter);
  app.use('/api', reportsRouter);
  app.use('/api', certificatesRouter);
  app.use('/api/student', studentRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
