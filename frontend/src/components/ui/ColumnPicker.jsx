'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, cx } from '@/components/ui/kit';

// Dropdown to choose which variables (fields) show as columns. `fields` is the
// inferred registry [{key,label,type}]; `value` is the selected key list.
export default function ColumnPicker({ fields = [], value = [], onChange, variant = 'light', max = 10 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const board = variant === 'board';
  const toggle = (k) => {
    if (value.includes(k)) onChange(value.filter((x) => x !== k));
    else if (value.length < max) onChange([...value, k]);
  };
  const shown = fields.filter((f) => f.label.toLowerCase().includes(q.trim().toLowerCase()));

  const btn = board
    ? 'flex items-center gap-1.5 rounded border border-[var(--board-line)] bg-[var(--board-2)] px-2 py-1 font-mono text-[11px] text-board-ink hover:border-[var(--accent)]'
    : 'flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)]';
  const panel = board
    ? 'absolute right-0 z-30 mt-1 w-64 rounded-lg border border-[var(--board-line)] bg-[var(--board)] p-2 shadow-soft'
    : 'absolute right-0 z-30 mt-1 w-64 rounded-xl border border-[var(--line)] bg-white p-2 shadow-card';
  const ink = board ? 'text-board-ink' : 'text-[var(--ink)]';
  const ink2 = board ? 'text-[var(--board-ink-2)]' : 'text-[var(--ink-3)]';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={btn}>
        <Icon d="M3 6h18M6 12h12M10 18h4" className="h-3.5 w-3.5" strokeWidth={2} />
        {board ? 'COLUMNS' : 'Columns'} <span className={ink2}>({value.length})</span>
      </button>
      {open && (
        <div className={panel}>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter fields…"
            className={cx('mb-2 w-full rounded border px-2 py-1 text-xs outline-none',
              board ? 'border-[var(--board-line)] bg-[var(--board-2)] text-board-ink placeholder:text-[var(--board-ink-2)]' : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)]')}
          />
          <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            {shown.map((f) => {
              const on = value.includes(f.key);
              const disabled = !on && value.length >= max;
              return (
                <button
                  key={f.key} type="button" onClick={() => toggle(f.key)} disabled={disabled}
                  className={cx('flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs',
                    on ? (board ? 'bg-[var(--board-2)]' : 'bg-[var(--accent-soft)]') : 'hover:bg-[var(--surface-2)]',
                    disabled && 'cursor-not-allowed opacity-40')}
                >
                  <span className={cx('truncate', on ? ink : ink2)}>{f.label}</span>
                  <span className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : board ? 'border-[var(--board-line)]' : 'border-[var(--line)]')}>
                    {on && <Icon d="M5 12l4 4 10-10" className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
            {shown.length === 0 && <p className={cx('px-2 py-3 text-center text-xs', ink2)}>No fields.</p>}
          </div>
          <p className={cx('mt-1.5 border-t px-1 pt-1.5 text-[10px]', board ? 'border-[var(--board-line)] ' + ink2 : 'border-[var(--line)] ' + ink2)}>
            {value.length}/{max} selected · drag-free, saved automatically
          </p>
        </div>
      )}
    </div>
  );
}
