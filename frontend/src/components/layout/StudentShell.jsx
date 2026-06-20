'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { LogoMark } from '@/components/brand/Logo';
import ToastContainer from '@/components/shared/Toast';

const TABS = [
  { href: '/portal', label: 'Timetable' },
  { href: '/portal/results', label: 'My results' },
  { href: '/portal/certificates', label: 'Certificates' },
];

// Authenticated frame for student accounts. Guards the route and keeps students
// out of the staff app.
export default function StudentShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else if (user && user.kind !== 'student') router.replace('/dashboard');
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !user || !isAuthenticated || user.kind !== 'student') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>;
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight text-neutral-900">Indigo Learning</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-600 sm:inline">{user.firstName} {user.lastName}</span>
            <button onClick={handleLogout} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100">
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-4">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                  active ? 'border-teal-600 font-medium text-teal-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <ToastContainer />
    </div>
  );
}
