'use client';

import { useEffect } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { initDb } from '@/services/database';

/**
 * Tracks online/offline status and the offline outbox, and drains it to the
 * cloud automatically when the connection returns. Mount once high in the tree.
 */
export function useSync() {
  const { isOnline, syncStatus, pendingCount, conflicts, setOnline, refreshPending, sync, resolve } =
    useSyncStore();

  useEffect(() => {
    let mounted = true;

    (async () => {
      await initDb();
      if (!mounted) return;
      await refreshPending();
      // Drain anything left over from a previous offline session.
      if (navigator.onLine) sync().catch(() => {});
    })();

    const goOnline = () => {
      setOnline(true);
      sync().catch(() => {}); // drain the moment we're back online
    };
    const goOffline = () => setOnline(false);

    if (typeof navigator !== 'undefined') setOnline(navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnline, refreshPending, sync]);

  return { isOnline, syncStatus, pendingCount, conflicts, refreshPending, sync, resolve };
}
