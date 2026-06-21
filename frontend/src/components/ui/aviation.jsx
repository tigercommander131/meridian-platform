'use client';

import { flight } from '@/services/data';
import { cx } from './kit';

const LAMP = {
  go: 'text-[var(--lamp-go)]',
  warn: 'text-[var(--lamp-warn)]',
  stop: 'text-[var(--lamp-stop)]',
  idle: 'text-[var(--lamp-idle)]',
  departed: 'text-[var(--board-ink-2)]',
};

// Pulsing status lamp (aviation indicator).
export function Lamp({ kind = 'idle', pulse = false, className }) {
  return <span className={cx('lamp', LAMP[kind], pulse && kind !== 'departed' && 'lamp-pulse', className)} style={{ backgroundColor: 'currentColor' }} />;
}

// Board-style status: lamp + monospace label. `onBoard` = rendered on the dark board.
export function FlightStatus({ status, onBoard = false, className }) {
  const f = flight(status);
  return (
    <span className={cx('inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider', className)}>
      <Lamp kind={f.lamp} pulse />
      <span className={onBoard ? LAMP[f.lamp] : ''}>{f.label}</span>
    </span>
  );
}

// Rubber-stamp accent label (e.g. CLEARED / DECLINED) for tickets.
export function Stamp({ children, tone = 'go', className }) {
  const c = tone === 'stop' ? 'text-[var(--lamp-stop)] border-[var(--lamp-stop)]'
    : tone === 'warn' ? 'text-[var(--lamp-warn)] border-[var(--lamp-warn)]'
    : 'text-[var(--accent)] border-[var(--accent)]';
  return (
    <span className={cx('inline-block rotate-[-8deg] rounded-md border-2 px-2.5 py-1 font-mono text-sm font-bold uppercase tracking-widest opacity-80', c, className)}>
      {children}
    </span>
  );
}

// Big monospace "station" code used on tickets/board (e.g. SYD).
export function Station({ code, sub, className, onBoard = false }) {
  return (
    <div className={cx('leading-none', className)}>
      <p className={cx('font-mono text-2xl font-bold tracking-tight', onBoard ? 'text-board-ink' : 'text-[var(--ink)]')}>{code}</p>
      {sub && <p className={cx('mt-1 text-[11px]', onBoard ? 'text-[var(--board-ink-2)]' : 'text-[var(--ink-3)]')}>{sub}</p>}
    </div>
  );
}

// Dashed flight path with a small plane glyph (ticket divider).
export function FlightPath({ onBoard = false, className }) {
  const stroke = onBoard ? 'rgba(232,237,242,.35)' : 'var(--line-2)';
  const plane = onBoard ? 'var(--board-ink)' : 'var(--accent)';
  return (
    <div className={cx('flex items-center', className)}>
      <span className="h-px flex-1" style={{ background: `repeating-linear-gradient(90deg, ${stroke} 0 5px, transparent 5px 10px)` }} />
      <svg viewBox="0 0 24 24" className="mx-1.5 h-4 w-4 shrink-0" fill={plane}><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L11 19v-5.5z" /></svg>
      <span className="h-px flex-1" style={{ background: `repeating-linear-gradient(90deg, ${stroke} 0 5px, transparent 5px 10px)` }} />
    </div>
  );
}
