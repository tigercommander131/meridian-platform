'use client';

import { useCallback } from 'react';
import { run, all, enqueue } from '@/services/database';
import { useSyncStore } from '@/stores/syncStore';

/**
 * Read/write the local offline SQLite DB.
 * Writes also drop an event in the sync outbox so it reaches the cloud later.
 */
export function usePersist() {
  const refreshPending = useSyncStore((s) => s.refreshPending);

  const create = useCallback(
    async (table, record) => {
      const cols = Object.keys(record);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => record[c]);
      await run(
        `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
        values
      );
      await enqueue(`${table}.upsert`, record);
      await refreshPending();
      return record;
    },
    [refreshPending]
  );

  const list = useCallback(async (table) => all(`SELECT * FROM ${table}`), []);

  return { create, list };
}
