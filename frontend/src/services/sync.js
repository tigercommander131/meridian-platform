import { api } from './api';
import { pendingEvents, markSynced, getEvent } from './database';

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

/**
 * Resolve a single sync conflict.
 *  - choice 'server': keep the server version, discard the local edit.
 *  - choice 'mine':   re-send the local event with an override so it wins.
 */
export async function resolveConflict(eventId, choice) {
  const local = await getEvent(eventId);
  if (!local) return { ok: false, reason: 'event not found locally' };

  if (choice === 'server') {
    await markSynced(eventId);
    return { ok: true, choice };
  }

  // choice === 'mine'
  const res = await api.post('/sync', {
    events: [{
      eventId,
      eventType: local.event_type,
      data: JSON.parse(local.payload),
      resolution: 'override',
    }],
  });
  const result = res.events.find((e) => e.eventId === eventId);
  if (result && result.status === 'synced') {
    await markSynced(eventId);
    return { ok: true, choice };
  }
  return { ok: false, reason: result?.status || 'unknown' };
}
