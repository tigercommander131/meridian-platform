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
  // Messaging connector (Resend). Optional — falls back to console logging.
  emailApiKey: process.env.EMAIL_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  // Public app URL used to build invitation accept/decline links.
  appUrl: process.env.APP_URL || process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3000',
  // Claude API key for the AI operations report (optional — deterministic fallback otherwise).
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
};
