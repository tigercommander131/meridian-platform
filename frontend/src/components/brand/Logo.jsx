// Brand mark: a teal rounded square with an abstract activity/pulse line.
// Vector only (no emoji), neutral + single teal accent per design system.
export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-[var(--accent)] ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h3l2-5 4 10 2-5h7" />
      </svg>
    </span>
  );
}

export function Wordmark({ subtitle = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="h-8 w-8" />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-neutral-900">CTOP</p>
        {subtitle && <p className="text-[11px] text-neutral-400">Clinical Training Operations Platform</p>}
      </div>
    </div>
  );
}
