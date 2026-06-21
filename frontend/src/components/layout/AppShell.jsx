'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';
import Header from './Header';
import Sidebar from './Sidebar';
import ToastContainer from '@/components/shared/Toast';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import Tour from '@/components/tour/Tour';
import { TOUR_STEPS } from '@/components/tour/steps';
import { Spinner } from '@/components/ui/kit';
import { orgApi } from '@/services/data';
import { apply as applyAppearance, applyAccent } from '@/utils/appearance';

export default function AppShell({ children }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [org, setOrg] = useState(null);

  useRealtime();

  // Apply local appearance prefs (density/motion/cached accent) on first paint.
  useEffect(() => { applyAppearance(); }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  // Load org branding once authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    orgApi.get().then((o) => { setOrg(o); if (o.accent) applyAccent(o.accent); }).catch(() => {});
  }, [isAuthenticated]);

  if (isLoading || !user || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-[var(--ink-3)]">
        <Spinner className="h-4 w-4 text-[var(--accent)]" /> Loading…
      </div>
    );
  }

  function handleLogout() { logout(); router.replace('/login'); }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header user={user} org={org} onLogout={handleLogout} onMenu={() => setMenuOpen((v) => !v)} />

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-[var(--line)] bg-white md:block">
          <Sidebar user={user} org={org} />
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <aside className="absolute left-0 top-14 h-full w-64 border-r border-[var(--line)] bg-white shadow-pop">
              <Sidebar user={user} org={org} onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">
          <div className="mx-auto max-w-5xl animate-in">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>

      <ToastContainer />
      <Tour steps={TOUR_STEPS} />
    </div>
  );
}
