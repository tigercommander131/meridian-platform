'use client';

import { LogoMark } from '@/components/brand/Logo';

function Avatar({ user }) {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">
      {initials || '?'}
    </span>
  );
}

export default function Header({ user, onLogout, onMenu }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden" aria-label="Toggle menu">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight text-neutral-900">CTOP</span>
          <span className="hidden text-xs text-neutral-400 sm:inline">Clinical Training Operations</span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <Avatar user={user} />
            <span className="hidden text-sm text-neutral-700 sm:inline">{user.firstName} {user.lastName}</span>
          </div>
        )}
        <button onClick={onLogout} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100">
          Sign out
        </button>
      </div>
    </header>
  );
}
