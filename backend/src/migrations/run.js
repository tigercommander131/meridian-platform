import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getPool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function migrationFiles() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
}

async function applied() {
  const res = await query('SELECT name FROM _migrations ORDER BY name');
  return new Set(res.rows.map((r) => r.name));
}

async function up() {
  await ensureMigrationsTable();
  const done = await applied();
  const files = migrationFiles();
  let ran = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`▶ applying ${file}`);
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✖ failed ${file}:`, err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }
  console.log(ran ? `✅ ${ran} migration(s) applied` : '✅ already up to date');
  process.exit(0);
}

async function status() {
  await ensureMigrationsTable();
  const done = await applied();
  for (const file of migrationFiles()) {
    console.log(`${done.has(file) ? '[done]' : '[    ]'} ${file}`);
  }
  process.exit(0);
}

async function down() {
  console.log('down: not implemented for MVP (drop the DB to reset)');
  process.exit(0);
}

const cmd = process.argv[2] || 'up';
if (cmd === 'up') up();
else if (cmd === 'status') status();
else if (cmd === 'down') down();
else {
  console.log('usage: run.js up|status|down');
  process.exit(1);
}
