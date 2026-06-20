import { create } from 'zustand';
import { pendingEvents } from '@/services/database';

export const useSyncStore = create((set, get) => ({
  isOnline: true,
  syncStatus: 'idle', // idle | pending | syncing | synced | error
  pendingCount: 0,

  setOnline: (isOnline) => set({ isOnline }),

  async refreshPending() {
    try {
      const events = await pendingEvents();
      set({
        pendingCount: events.length,
        syncStatus: events.length > 0 ? 'pending' : 'synced',
      });
    } catch {
      // DB not ready yet — leave counts as-is.
    }
  },

  setStatus: (syncStatus) => set({ syncStatus }),
}));
