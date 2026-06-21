'use client';

import { LogoMark } from '@/components/brand/Logo';
import { Avatar, Button, Icon } from '@/components/ui/kit';

export default function Header({ user, org, onLogout, onMenu }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--line)] bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg p-1.5 text-[var(--ink-2)] hover:bg-neutral-100 md:hidden" aria-label="Toggle menu">
          <Icon d="M4 6h16M4 12h16M4 18h16" className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="font-mono text-[15px] font-bold tracking-tight text-[var(--ink)]">CTOP</span>
          {org?.name && (
            <span className="hidden items-center gap-2 sm:flex">
              <span className="h-3.5 w-px bg-[var(--line-2)]" />
              <span className="text-sm text-[var(--ink-2)]">{org.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar name={`${user.firstName} ${user.lastName}`} />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium text-[var(--ink)]">{user.firstName} {user.lastName}</p>
              <p className="text-[11px] text-[var(--ink-3)]">{user.email}</p>
            </div>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={onLogout}>Sign out</Button>
      </div>
    </header>
  );
}
