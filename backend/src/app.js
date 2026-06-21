import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/environment.js';
import authRouter from './routes/auth.js';
import organisationsRouter from './routes/organisations.js';
import ctopRouter from './routes/ctop.js';
import { getInvitation, respondInvitation } from './controllers/invitationsController.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Express app, no listener — imported by server.js (runtime) and tests (supertest).
export function createApp() {
  const app = express();

  // Behind Railway's proxy.
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : []),
  ];
  app.use(cors({
    origin(origin, cb) {
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

  // Public invitation accept/decline (no auth — tokenised link).
  app.get('/api/invitations/:token', getInvitation);
  app.post('/api/invitations/:token/respond', respondInvitation);

  app.use('/api/auth', authRouter);
  app.use('/api/organisations', organisationsRouter);
  app.use('/api', ctopRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
