// Compact metric card with a vector icon. Neutral surface + teal accent.
const ICONS = {
  courses: 'M4 5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM9 13h6M9 17h6',
  pending: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  learners: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0',
};

export default function StatCard({ label, value, icon, hint }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS[icon] || ICONS.courses} />
          </svg>
        </span>
      </div>
    </div>
  );
}
