import http from 'http';
import { config } from './config/environment.js';
import { testConnection } from './config/database.js';
import { createApp } from './app.js';
import { initRealtime } from './realtime.js';

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

async function start() {
  await testConnection();
  server.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv}`);
  });
}

start();
