'use client';

import { useSync } from '@/hooks/useSync';
import { LogoMark } from '@/components/brand/Logo';

function Avatar({ user }) {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">
      {initials || '?'}
    </span>
  );
}

function SyncBadge() {
  const { isOnline, pendingCount } = useSync();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isOnline ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-teal-600' : 'bg-amber-500'}`} />
      {isOnline ? 'Online' : 'Offline'}
      {pendingCount > 0 && ` · ${pendingCount} queued`}
    </span>
  );
}

export default function Header({ user, onLogout, onMenu }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight text-neutral-900">PARASOL EMT</span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <SyncBadge />
        {user && (
          <div className="flex items-center gap-2">
            <Avatar user={user} />
            <span className="hidden text-sm text-neutral-700 sm:inline">{user.firstName} {user.lastName}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
