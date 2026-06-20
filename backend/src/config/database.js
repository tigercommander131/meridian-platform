import pg from 'pg';
import { config } from './environment.js';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    // Enable TLS when DATABASE_SSL=true or the URL asks for it (managed
    // providers' public endpoints). Railway's *private* URL needs no SSL.
    const url = config.databaseUrl || '';
    const useSsl = process.env.DATABASE_SSL === 'true' || /sslmode=require/i.test(url);

    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
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
