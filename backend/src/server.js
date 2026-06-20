import { config } from './config/environment.js';
import { testConnection } from './config/database.js';
import { createApp } from './app.js';

const app = createApp();

async function start() {
  await testConnection();
  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv}`);
  });
}

start();
