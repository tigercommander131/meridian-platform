// Consistent page title block with an optional action slot on the right.
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--ink-2)]">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
