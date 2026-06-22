'use client';

import { Icon, Input, Select, cx } from '@/components/ui/kit';
import { COURSE_WINDOWS, distinct, statusLabel, courseFilterActive, emptyCourseFilter } from '@/services/data';

// Shared course filter bar. `acc` supplies field accessors (so it works for both
// the card list and the board); `variant` switches between the light page and the
// dark departures board.
export default function CourseFilters({ courses = [], value, onChange, acc, options, variant = 'light', count, total }) {
  // Prefer server-provided facet lists (paginated callers); else derive from the loaded set.
  const types = options?.types ?? distinct(courses, acc.type);
  const regions = options?.regions ?? distinct(courses, acc.region);
  const statuses = options?.statuses ?? distinct(courses, acc.status);
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const active = courseFilterActive(value);

  if (variant === 'board') {
    const sel = 'rounded border border-[var(--board-line)] bg-[var(--board-2)] px-2 py-1 font-mono text-[11px] text-board-ink outline-none focus:border-[var(--accent)]';
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--board-line)] px-4 py-2.5">
        <input value={value.q} onChange={set('q')} placeholder="SEARCH…"
          className={cx(sel, 'w-32 placeholder:text-[var(--board-ink-2)]')} />
        <select value={value.type} onChange={set('type')} className={sel}>
          <option value="">ALL TYPES</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={value.region} onChange={set('region')} className={sel}>
          <option value="">ALL LOCATIONS</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={value.status} onChange={set('status')} className={sel}>
          <option value="">ALL STATUS</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s).toUpperCase()}</option>)}
        </select>
        <select value={value.when} onChange={set('when')} className={sel}>
          {COURSE_WINDOWS.map((w) => <option key={w.key} value={w.key}>{w.label.toUpperCase()}</option>)}
        </select>
        {active && (
          <button onClick={() => onChange(emptyCourseFilter())} className="font-mono text-[11px] text-[var(--board-ink-2)] hover:text-board-ink">CLEAR ✕</button>
        )}
        {count != null && <span className="ml-auto font-mono text-[10px] text-[var(--board-ink-2)]">{count}/{total}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative grow sm:grow-0">
        <Icon d="M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
        <Input value={value.q} onChange={set('q')} placeholder="Search courses…" className="w-full pl-8 sm:w-56" />
      </div>
      <Select value={value.type} onChange={set('type')} className="w-auto">
        <option value="">All types</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
      <Select value={value.region} onChange={set('region')} className="w-auto">
        <option value="">All locations</option>
        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
      </Select>
      <Select value={value.status} onChange={set('status')} className="w-auto">
        <option value="">Any status</option>
        {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
      </Select>
      <Select value={value.when} onChange={set('when')} className="w-auto">
        {COURSE_WINDOWS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
      </Select>
      {active && (
        <button onClick={() => onChange(emptyCourseFilter())} className="text-xs font-medium text-[var(--accent-ink)] hover:underline">Clear</button>
      )}
      {count != null && <span className="ml-auto text-xs text-[var(--ink-3)]">{count} of {total}</span>}
    </div>
  );
}
