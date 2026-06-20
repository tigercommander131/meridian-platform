import { api } from './api';
import { pendingEvents, markSynced } from './database';

/**
 * Drain the offline outbox to the cloud.
 * Reads pending events from local SQLite, POSTs them to /api/sync, marks the
 * accepted ones synced locally, and returns any conflicts for the UI to show.
 */
export async function drainQueue() {
  const pending = await pendingEvents();
  if (pending.length === 0) {
    return { synced: 0, failed: 0, conflicts: [], drained: 0 };
  }

  const events = pending.map((e) => ({
    eventId: e.event_id,
    eventType: e.event_type,
    data: JSON.parse(e.payload),
  }));

  const res = await api.post('/sync', { events });

  const conflicts = [];
  for (const result of res.events) {
    if (result.status === 'synced') {
      await markSynced(result.eventId);
    } else if (result.status === 'conflict') {
      conflicts.push(result);
    }
    // 'failed' events stay pending and retry on the next drain.
  }

  return {
    synced: res.synced,
    failed: res.failed,
    conflicts,
    drained: pending.length,
  };
}
