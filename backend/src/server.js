import http from 'http';
import { config } from './config/environment.js';
import { testConnection } from './config/database.js';
import { createApp } from './app.js';
import { initRealtime } from './realtime.js';

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

// In production, refuse to boot with placeholder secrets — a default JWT secret
// means anyone can forge a login token.
function assertProdSecrets() {
  if (config.nodeEnv !== 'production') return;
  const weak = [];
  if (!process.env.JWT_SECRET || /change_me|dev_secret/i.test(process.env.JWT_SECRET)) weak.push('JWT_SECRET');
  if (!process.env.JWT_REFRESH_SECRET || /change_me|dev_refresh/i.test(process.env.JWT_REFRESH_SECRET)) weak.push('JWT_REFRESH_SECRET');
  if (weak.length) {
    console.error(`❌ Refusing to start: weak/placeholder ${weak.join(' and ')} in production. Set strong values (openssl rand -hex 32).`);
    process.exit(1);
  }
}

async function start() {
  assertProdSecrets();
  await testConnection();
  server.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv}`);
  });
}

start();
