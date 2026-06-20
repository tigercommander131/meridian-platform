import { create } from 'zustand';
import { pendingEvents } from '@/services/database';
import { drainQueue, resolveConflict } from '@/services/sync';

export const useSyncStore = create((set, get) => ({
  isOnline: true,
  syncStatus: 'idle', // idle | pending | syncing | synced | error
  pendingCount: 0,
  conflicts: [],
  lastSyncedAt: null,

  setOnline: (isOnline) => set({ isOnline }),
  setStatus: (syncStatus) => set({ syncStatus }),

  async refreshPending() {
    try {
      const events = await pendingEvents();
      set({
        pendingCount: events.length,
        syncStatus: events.length > 0 ? 'pending' : get().syncStatus === 'syncing' ? 'syncing' : 'synced',
      });
    } catch {
      // DB not ready yet — leave counts as-is.
    }
  },

  // Drain the outbox to the cloud.
  async sync() {
    if (get().syncStatus === 'syncing') return;
    if (!get().isOnline) {
      set({ syncStatus: 'pending' });
      return;
    }
    set({ syncStatus: 'syncing' });
    try {
      const result = await drainQueue();
      await get().refreshPending();
      set({
        syncStatus: result.conflicts.length > 0 ? 'error' : 'synced',
        conflicts: result.conflicts,
        lastSyncedAt: new Date().toISOString(),
      });
      return result;
    } catch (err) {
      set({ syncStatus: 'error' });
      throw err;
    }
  },

  // Resolve one conflict, then drop it from the list.
  async resolve(eventId, choice) {
    const result = await resolveConflict(eventId, choice);
    if (result.ok) {
      const remaining = get().conflicts.filter((c) => c.eventId !== eventId);
      set({ conflicts: remaining, syncStatus: remaining.length ? 'error' : 'synced' });
      await get().refreshPending();
    }
    return result;
  },
}));
