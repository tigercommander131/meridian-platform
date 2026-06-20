'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Header from './Header';
import Sidebar from './Sidebar';

/**
 * Authenticated app frame. Guards the route (redirects to /login when not
 * authenticated), then renders Header + Sidebar + page content.
 */
export default function AppShell({ children }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Redirect once auth state is resolved.
  if (!isLoading && !isAuthenticated) {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header user={user} onLogout={handleLogout} onMenu={() => setMenuOpen((v) => !v)} />

      <div className="flex">
        {/* Sidebar — fixed on md+, slide-over on mobile */}
        <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white md:block">
          <Sidebar />
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-20 md:hidden">
            <div className="absolute inset-0 bg-black/20" onClick={() => setMenuOpen(false)} />
            <aside className="absolute left-0 top-14 h-full w-56 border-r border-neutral-200 bg-white">
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-6 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
