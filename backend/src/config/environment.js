import dotenv from 'dotenv';

// Backend uses .env.local (matches DEVELOPER_QUICK_START), falling back to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  jwtExpiresIn: '1h',
  jwtRefreshExpiresIn: '7d',
};
