import { Icon } from './kit';

// Compact metric card. Neutral surface, teal accent; optional tone tints the icon.
const ICONS = {
  courses: 'M4 5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM9 13h6M9 17h6',
  pending: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  learners: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0',
  ready: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  instructors: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0',
};
const TONES = {
  teal: 'bg-teal-50 text-teal-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  neutral: 'bg-neutral-100 text-neutral-500',
};

export default function StatCard({ label, value, icon, hint, tone = 'teal' }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-card transition-shadow hover:shadow-soft">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-[var(--ink-3)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">{value}</p>
          {hint && <p className="mt-1 text-xs text-[var(--ink-3)]">{hint}</p>}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone] || TONES.teal}`}>
          <Icon d={ICONS[icon] || ICONS.courses} className="h-[18px] w-[18px]" />
        </span>
      </div>
    </div>
  );
}
