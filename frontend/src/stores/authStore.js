import { create } from 'zustand';
import { auth } from '@/services/api';

// Reactive auth state. Source of truth for components; api.js owns token storage.
export const useAuthStore = create((set) => ({
  user: null,
  status: 'loading', // loading | authenticated | unauthenticated

  // Read persisted session on app load.
  hydrate() {
    const user = auth.getUser();
    set(
      auth.isAuthenticated() && user
        ? { user, status: 'authenticated' }
        : { user: null, status: 'unauthenticated' }
    );
  },

  async login(username, password) {
    const user = await auth.login(username, password);
    set({ user, status: 'authenticated' });
    return user;
  },

  logout() {
    auth.logout();
    set({ user: null, status: 'unauthenticated' });
  },
}));
