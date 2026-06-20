'use client';

import { useEffect } from 'react';
import { connectRealtime } from '@/services/realtime';
import { useRealtimeStore } from '@/stores/realtimeStore';

/**
 * Opens a live WebSocket connection and feeds incoming events into the store.
 * Mount once (e.g. in AppShell). Auto-reconnects on drop.
 */
export function useRealtime() {
  const { connection, events, setConnection, pushEvent } = useRealtimeStore();

  useEffect(() => {
    const conn = connectRealtime({
      onState: setConnection,
      onEvent: (event) => {
        // Skip the initial handshake frame; surface real domain events.
        if (event.type && event.type !== 'connected') pushEvent(event);
      },
    });
    return () => conn.close();
  }, [setConnection, pushEvent]);

  return { connection, events };
}
