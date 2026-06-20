'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';

// Centered, branded shell shared by /login and /signup.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-50 px-4">
      {/* subtle teal wash, top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-teal-50 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-neutral-500">{footer}</div>}

        <p className="mt-8 text-center text-xs text-neutral-400">
          Indigo Learning · Simulation-based education
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
        className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
    </label>
  );
}

export { Link };
