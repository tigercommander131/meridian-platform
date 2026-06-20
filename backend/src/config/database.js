import pg from 'pg';
import { config } from './environment.js';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
    pool.on('error', (err) => {
      console.error('Unexpected DB client error:', err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

export async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('📊 Database connected:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
}
