// Offline SQLite (sql.js) persisted to IndexedDB.
// Runs a real SQLite DB in the browser so scoring works with no WiFi.
// The DB binary is snapshotted into IndexedDB after every write.

import initSqlJs from 'sql.js';

const IDB_NAME = 'meridian_offline';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'db';

let SQL = null;
let db = null;
let ready = null;

// Minimal offline schema — the subset needed for offline scoring + a sync queue.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, cohort_id TEXT, scenario_id TEXT, status TEXT
);
CREATE TABLE IF NOT EXISTS rubric_scores (
  id TEXT PRIMARY KEY, session_id TEXT, participant_id TEXT, learner_id TEXT,
  rubric_id TEXT, scores TEXT, total_score INTEGER, assessor_notes TEXT,
  state TEXT, scored_at TEXT
);
-- Outbox: events captured offline, drained to POST /api/sync when online.
CREATE TABLE IF NOT EXISTS sync_queue (
  event_id TEXT PRIMARY KEY, event_type TEXT, payload TEXT,
  created_at TEXT, status TEXT DEFAULT 'pending'
);
`;

// --- tiny IndexedDB helpers (store the raw SQLite binary) ---

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const conn = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const conn = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- public API ---

export async function initDb() {
  if (ready) return ready;
  ready = (async () => {
    SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
    const saved = await idbGet(IDB_KEY);
    db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
    db.run(SCHEMA);
    if (!saved) await persist();
    return db;
  })();
  return ready;
}

/** Snapshot the in-memory DB to IndexedDB. Call after writes. */
export async function persist() {
  if (!db) return;
  await idbSet(IDB_KEY, db.export());
}

/** Run a write statement (INSERT/UPDATE/DELETE), then persist. */
export async function run(sql, params = []) {
  await initDb();
  db.run(sql, params);
  await persist();
}

/** Run a SELECT, return array of row objects. */
export async function all(sql, params = []) {
  await initDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/** Queue an event in the offline outbox for later sync. */
export async function enqueue(eventType, payload) {
  const eventId = `evt_${crypto.randomUUID()}`;
  await run(
    `INSERT INTO sync_queue (event_id, event_type, payload, created_at, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [eventId, eventType, JSON.stringify(payload), new Date().toISOString()]
  );
  return eventId;
}

export async function pendingEvents() {
  return all(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at`);
}

export async function markSynced(eventId) {
  await run(`UPDATE sync_queue SET status = 'synced' WHERE event_id = ?`, [eventId]);
}
