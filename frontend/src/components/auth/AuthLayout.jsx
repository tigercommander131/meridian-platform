'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';

// Centered, branded shell shared by /login and /signup.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4" style={{ background: 'var(--bg)' }}>
      {/* subtle teal wash + dotted grid, top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-teal-50 to-transparent" />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--ink-2)]">{subtitle}</p>}
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-soft">
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-[var(--ink-2)]">{footer}</div>}

        <p className="mt-8 text-center text-xs text-[var(--ink-3)]">
          CTOP · Clinical Training Operations Platform
        </p>
      </div>
    </div>
  );
}

// Shared field used by the auth forms.
export function Field({ label, hint, ...props }) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      <span className="flex items-baseline justify-between">
        {label}
        {hint && <span className="text-xs font-normal text-neutral-400">{hint}</span>}
      </span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
      />
    </label>
  );
}

export { Link };
