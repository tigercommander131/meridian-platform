'use client';

import { useEffect } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { initDb } from '@/services/database';

/**
 * Tracks online/offline status and the offline outbox.
 * Mount once high in the tree (e.g. dashboard layout).
 */
export function useSync() {
  const { isOnline, syncStatus, pendingCount, setOnline, refreshPending } = useSyncStore();

  useEffect(() => {
    let mounted = true;

    (async () => {
      await initDb();
      if (mounted) await refreshPending();
    })();

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    if (typeof navigator !== 'undefined') setOnline(navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnline, refreshPending]);

  return { isOnline, syncStatus, pendingCount, refreshPending };
}
