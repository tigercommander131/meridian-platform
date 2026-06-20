// Friendly empty placeholder with a vector icon and optional action.
export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon || 'M12 5v14M5 12h14'} />
        </svg>
      </span>
      <p className="mt-3 text-sm font-medium text-neutral-700">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
