'use client';

import { useToastStore } from '@/stores/toastStore';

const STYLES = {
  info: 'border-neutral-200 bg-white text-neutral-800',
  success: 'border-teal-200 bg-teal-50 text-teal-800',
  error: 'border-amber-200 bg-amber-50 text-amber-800',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm ${STYLES[t.type] || STYLES.info}`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
