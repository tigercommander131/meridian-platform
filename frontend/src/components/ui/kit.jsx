'use client';

import { forwardRef, useState } from 'react';

function cx(...c) { return c.filter(Boolean).join(' '); }

// --- Button ---------------------------------------------------------------
const BTN_VARIANTS = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 shadow-sm disabled:bg-teal-700/50',
  secondary: 'border border-[var(--line-2)] bg-white text-[var(--ink)] hover:bg-neutral-50',
  ghost: 'text-[var(--ink-2)] hover:bg-neutral-100 hover:text-[var(--ink)]',
  danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
  dark: 'bg-neutral-900 text-white hover:bg-neutral-800',
};
const BTN_SIZES = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-4 py-2.5 text-sm' };

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 disabled:cursor-not-allowed disabled:opacity-60',
        BTN_VARIANTS[variant], BTN_SIZES[size], className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// --- Card -----------------------------------------------------------------
export function Card({ className, children, padded = true, ...rest }) {
  return (
    <div className={cx('rounded-2xl border border-[var(--line)] bg-white shadow-card', padded && 'p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <Icon d={icon} className="h-[18px] w-[18px]" />
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--ink-3)]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// --- Badge ----------------------------------------------------------------
const BADGE_TONES = {
  neutral: 'bg-neutral-100 text-neutral-600',
  teal: 'bg-teal-50 text-teal-700 ring-1 ring-teal-600/10',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/10',
  blue: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/10',
  dark: 'bg-neutral-900 text-white',
};
export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', BADGE_TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

// --- Form controls --------------------------------------------------------
export function Label({ children, className }) {
  return <span className={cx('lbl', className)}>{children}</span>;
}

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('ctl', className)} {...rest} />;
});

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return <select ref={ref} className={cx('ctl', className)} {...rest}>{children}</select>;
});

export const Textarea = forwardRef(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('ctl', className)} {...rest} />;
});

// Labelled field wrapper.
export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-[var(--ink-3)]">{hint}</p>}
    </label>
  );
}

// --- Tabs -----------------------------------------------------------------
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[var(--line)]">
      {tabs.map((t) => {
        const on = (active ?? tabs[0].value) === t.value;
        return (
          <button key={t.value} onClick={() => onChange(t.value)}
            className={cx(
              '-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              on ? 'border-teal-700 text-teal-700' : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
            )}>
            {t.label}{typeof t.count === 'number' && <span className="ml-1.5 text-xs text-[var(--ink-3)]">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// --- Misc -----------------------------------------------------------------
export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-neutral-200/70', className)} />;
}

export function Spinner({ className }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Icon({ d, className = 'h-5 w-5', strokeWidth = 1.8 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

export function Avatar({ name, className = 'h-8 w-8 text-xs' }) {
  const initials = (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-800', className)}>
      {initials || '?'}
    </span>
  );
}

export { cx };
