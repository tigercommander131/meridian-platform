'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Auth state + actions. Hydrates persisted session once on mount.
 * { user, status, isAuthenticated, login, logout }
 */
export function useAuth() {
  const { user, status, hydrate, login, logout } = useAuthStore();

  useEffect(() => {
    if (status === 'loading') hydrate();
  }, [status, hydrate]);

  return {
    user,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    login,
    logout,
  };
}
