'use client';

import { useEffect, useState } from 'react';
import { Button, Badge, Spinner, Icon, cx } from '@/components/ui/kit';
import { courseActionsApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

const SEV = { high: 'rose', medium: 'amber', low: 'blue' };

// Modal: AI proposes fixes for a course → user ticks which to apply → applied on confirm.
export default function AiFixPanel({ courseId, courseName, onClose, onApplied }) {
  const [plan, setPlan] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(true);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    let live = true;
    courseActionsApi.plan(courseId)
      .then((p) => { if (!live) return; setPlan(p); setSel(new Set(p.actions.filter((a) => !a.disabled && a.type !== 'note').map((a) => a.id))); })
      .catch((e) => toast.error(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [courseId]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const actionable = (plan?.actions || []).filter((a) => !a.disabled && a.type !== 'note');

  async function apply() {
    setApplying(true);
    try {
      const r = await courseActionsApi.apply(courseId, [...sel]);
      setResults(r);
      toast.success(`Applied ${r.applied.filter((x) => x.ok).length} action(s)`);
      onApplied?.(r);
    } catch (e) { toast.error(e.message); } finally { setApplying(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-soft sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)]">
              <Icon d={['M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z']} className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">AI fix — {courseName || 'course'}</p>
              <p className="mt-0.5 text-xs text-[var(--ink-3)]">Review the proposed actions, then apply the ones you approve.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink)]"><Icon d="M18 6L6 18M6 6l12 12" className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {busy ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--ink-3)]"><Spinner className="h-4 w-4 text-[var(--accent)]" /> Planning fixes…</div>
          ) : results ? (
            <div className="space-y-2">
              <p className="lbl mb-1">Result</p>
              {results.applied.map((r, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-[var(--line)] p-2.5 text-sm">
                  <Icon d={r.ok ? 'M5 12l4 4 10-10' : 'M18 6L6 18M6 6l12 12'} className={cx('mt-0.5 h-4 w-4 shrink-0', r.ok ? 'text-emerald-600' : 'text-rose-600')} strokeWidth={2.4} />
                  <span className="text-[var(--ink-2)]">{r.message}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-[var(--ink-3)]">Course status now: <span className="font-medium text-[var(--ink)]">{results.status?.replace(/_/g, ' ')}</span></p>
            </div>
          ) : actionable.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--ink-3)]">Nothing to fix — this course is in good shape.</p>
          ) : (
            <>
              {!plan.emailEnabled && (
                <p className="mb-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--ink-3)]">No email connector set — invitations are created and logged, but not emailed.</p>
              )}
              <div className="space-y-2">
                {plan.actions.map((a) => {
                  const on = sel.has(a.id);
                  const off = a.disabled || a.type === 'note';
                  return (
                    <button key={a.id} type="button" disabled={off} onClick={() => toggle(a.id)}
                      className={cx('flex w-full items-start gap-3 rounded-xl border p-3 text-left',
                        off ? 'border-[var(--line)] opacity-70' : on ? 'border-[color:var(--accent)]/50 bg-[var(--accent-soft)]/40' : 'border-[var(--line)] hover:border-[color:var(--accent)]/40')}>
                      {!off && (
                        <span className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--line)]')}>
                          {on && <Icon d="M5 12l4 4 10-10" className="h-3 w-3" strokeWidth={3} />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={SEV[a.severity] || 'blue'}>{a.severity}</Badge>
                          <span className="text-sm font-medium text-[var(--ink)]">{a.label}</span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ink-3)]">{a.detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] p-4">
          <Button variant="ghost" onClick={onClose}>{results ? 'Close' : 'Cancel'}</Button>
          {!results && actionable.length > 0 && (
            <Button onClick={apply} disabled={applying || sel.size === 0}>
              {applying ? <><Spinner className="h-4 w-4" /> Applying…</> : `Apply ${sel.size} action${sel.size === 1 ? '' : 's'}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
