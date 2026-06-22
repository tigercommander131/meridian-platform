'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Spinner, Icon, cx } from '@/components/ui/kit';
import { reportApi, fmtDate } from '@/services/data';
import { toast } from '@/stores/toastStore';
import { reportStore } from '@/stores/reportStore';
import AiFixPanel from '@/components/ops/AiFixPanel';

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-AU');

const SEV = {
  high: { tone: 'rose', label: 'High', chip: 'bg-rose-50 text-rose-600' },
  medium: { tone: 'amber', label: 'Medium', chip: 'bg-amber-50 text-amber-600' },
  low: { tone: 'blue', label: 'Low', chip: 'bg-blue-50 text-blue-600' },
};
const sev = (s) => SEV[s] || SEV.low;

// Icon per finding type (24x24 stroke paths) — gives each solution a glance-able marker.
const TYPE_ICON = {
  course_director: ['M12 14a4 4 0 100-8 4 4 0 000 8z', 'M8.5 13.5L7 21l5-3 5 3-1.5-7.5'],        // award = leadership role
  medical_director: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 8v8M8 12h8'],                       // medical cross
  instructors: ['M9 11a4 4 0 100-8 4 4 0 000 8z', 'M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2', 'M16 3.2a4 4 0 010 7.6', 'M22 21v-2a4 4 0 00-3-3.9'], // people
  underfilled: ['M22 17l-8.5-8.5-5 5L2 6', 'M16 17h6v-6'],                                          // trending down
  waitlist: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 7v5l3 2'],                                   // clock / queue
  overcapacity: ['M10.3 4L2.3 18a2 2 0 001.7 3h16a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0z', 'M12 9v4M12 17h.01'], // warning
};
const typeIcon = (t) => TYPE_ICON[t] || ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 8h.01M11 12h1v4h1'];

// Time windows for the filter. days = null → all courses.
const WINDOWS = [
  { key: 'w1', label: '1 week', days: 7 },
  { key: 'w2', label: '2 weeks', days: 14 },
  { key: 'w4', label: '4 weeks', days: 28 },
  { key: 'w6', label: '6 weeks', days: 42 },
  { key: 'all', label: 'All', days: null },
];

// Strip shouty category prefixes the model sometimes prepends to headings.
const stripCategory = (s) => s.replace(/^(compliance|staffing|viability|capacity|waitlist|viability risk)\s*[—–:-]\s*/i, '');

function inline(text, key) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={`${key}-${i}`} className="font-semibold text-[var(--ink)]">{p.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{p}</span>
  );
}
function Narrative({ text }) {
  const lines = String(text).split(/\n/);
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-[var(--ink-2)]">
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return null;
        if (t.startsWith('## ')) return <p key={i} className="pt-1 text-sm font-semibold text-[var(--ink)]">{inline(stripCategory(t.slice(3)), i)}</p>;
        const li = t.match(/^(\d+\.|[-*])\s+(.*)$/);
        if (li) return (
          <div key={i} className="flex gap-2 pl-1"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" /><span>{inline(li[2], i)}</span></div>
        );
        return <p key={i}>{inline(t, i)}</p>;
      })}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
      <p className={cx('font-mono text-lg font-bold tnum', tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-[var(--ink)]')}>{value}</p>
      <p className="text-[11px] text-[var(--ink-3)]">{label}</p>
    </div>
  );
}

export default function OpsReport() {
  const [data, setData] = useState(() => reportStore.get());
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [win, setWin] = useState('all');
  const [fix, setFix] = useState(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    try { const r = await reportApi.get(); setData(r); reportStore.set(r); setShowAll(false); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  const all = data?.findings || [];
  const days = WINDOWS.find((w) => w.key === win)?.days ?? null;

  const findings = useMemo(() => {
    if (days == null) return all;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const cutoff = start.getTime() + days * 86400000;
    return all.filter((f) => {
      if (!f.date) return false;                       // undated courses only show under "All"
      const t = new Date(f.date).getTime();
      return t >= start.getTime() && t <= cutoff;
    });
  }, [all, days]);

  // Stat tiles follow the active filter so the numbers always match what's shown.
  const stats = useMemo(() => ({
    atRisk: new Set(findings.map((f) => f.courseId)).size,
    underfilled: findings.filter((f) => f.type === 'underfilled').length,
    waitlistAlerts: findings.filter((f) => f.type === 'waitlist').length,
    staffingGaps: findings.filter((f) => ['instructors', 'course_director', 'medical_director'].includes(f.type)).length,
  }), [findings]);

  const shown = showAll ? findings : findings.slice(0, 6);
  const ai = data?.source === 'ai';

  return (
    <>
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)]">
            <Icon d={['M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z']} className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">AI operations report</p>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">Scans every course for viability, waitlist, and staffing issues — and suggests solutions.</p>
          </div>
        </div>
        {data
          ? <Button size="sm" variant="secondary" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Re-run'}</Button>
          : <Button size="sm" onClick={run} disabled={busy}>{busy ? <><Spinner className="h-4 w-4" /> Analysing…</> : 'Run report'}</Button>}
      </div>

      {data && (
        <div className="mt-4 animate-in">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={ai ? 'teal' : 'neutral'} dot>{ai ? `Claude ${data.model || ''}`.trim() : 'Rule-based'}</Badge>
            {!data.aiEnabled && <span className="text-[11px] text-[var(--ink-3)]">Set <code className="rounded bg-[var(--surface-2)] px-1">CLAUDE_API_KEY</code> on the API service for an AI-written briefing.</span>}
          </div>

          {/* Time-window filter */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-[var(--ink-3)]">Courses in</span>
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                onClick={() => { setWin(w.key); setShowAll(false); }}
                className={cx(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition',
                  win === w.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="At risk" value={stats.atRisk} tone={stats.atRisk ? 'rose' : undefined} />
            <Stat label="Under minimum" value={stats.underfilled} tone={stats.underfilled ? 'amber' : undefined} />
            <Stat label="Waitlist alerts" value={stats.waitlistAlerts} tone={stats.waitlistAlerts ? 'amber' : undefined} />
            <Stat label="Staffing gaps" value={stats.staffingGaps} tone={stats.staffingGaps ? 'rose' : undefined} />
          </div>

          {data.stats.revenueAtRisk > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Revenue at risk" value={money(data.stats.revenueAtRisk)} tone="rose" />
              <Stat label="Refund liability" value={money(data.stats.refundLiability)} tone="amber" />
              <Stat label="Expected revenue" value={money(data.stats.expectedRevenue)} />
              <Stat label="Net margin" value={money(data.stats.netMargin)} />
            </div>
          )}

          {/* Suggested solutions — shown first */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="lbl">Suggested solutions</p>
              {findings.length > 0 && <span className="text-[11px] text-[var(--ink-3)]">{findings.length} item{findings.length === 1 ? '' : 's'}</span>}
            </div>
            {findings.length === 0 ? (
              <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--ink-3)]">
                No issues for courses in this window.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {shown.map((f, i) => {
                    const s = sev(f.severity);
                    return (
                      <div key={i} role="link" tabIndex={0}
                        onClick={() => router.push(`/courses/${f.courseId}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/courses/${f.courseId}`); }}
                        className="group block cursor-pointer rounded-xl border border-[var(--line)] p-3 transition-all hover:border-[color:var(--accent)]/40 hover:shadow-soft">
                        <div className="flex items-start gap-3">
                          <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', s.chip)}>
                            <Icon d={typeIcon(f.type)} className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={s.tone}>{s.label}</Badge>
                              <span className="text-sm font-medium text-[var(--ink)]">{f.title}</span>
                              <span className="text-xs text-[var(--ink-3)]">· {f.course}</span>
                              {f.date && <span className="text-xs text-[var(--ink-3)]">· {fmtDate(f.date)}</span>}
                            </div>
                            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--ink-2)]">
                              <Icon d="M13 7l5 5-5 5M6 12h12" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /> {f.action}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFix({ id: f.courseId, name: f.course }); }}
                              className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs font-medium text-[var(--accent-ink)] hover:border-[color:var(--accent)]/40">
                              Fix
                            </button>
                            <span className="text-[var(--ink-3)] transition-colors group-hover:text-[var(--accent)]"><Icon d="M9 6l6 6-6 6" className="h-4 w-4" /></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {findings.length > 6 && (
                  <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-[var(--accent-ink)] hover:underline">
                    {showAll ? 'Show fewer' : `Show all ${findings.length} solutions`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Operations briefing — collapsible, below the solutions */}
          {data.narrative && (
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <button
                onClick={() => setShowBriefing((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="lbl">Operations briefing</span>
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--accent-ink)]">
                  {showBriefing ? 'Hide' : 'Show'}
                  <Icon d={showBriefing ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} className="h-4 w-4" />
                </span>
              </button>
              {showBriefing && (
                <div className="mt-3 animate-in rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
                  <Narrative text={data.narrative} />
                  <p className="mt-3 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--ink-3)]">
                    Summary of the top priorities across all {all.length} item{all.length === 1 ? '' : 's'}. The itemised list is above.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
    {fix && (
      <AiFixPanel courseId={fix.id} courseName={fix.name} onClose={() => setFix(null)} onApplied={() => run()} />
    )}
    </>
  );
}
