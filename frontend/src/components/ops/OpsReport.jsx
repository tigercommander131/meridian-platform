'use client';

import { useState } from 'react';
import { Card, Button, Badge, Spinner, Icon, cx } from '@/components/ui/kit';
import { reportApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

const SEV = {
  high: { tone: 'rose', label: 'High' },
  medium: { tone: 'amber', label: 'Medium' },
  low: { tone: 'blue', label: 'Low' },
};

// Tiny markdown-ish renderer: **bold**, ## heading, -/numbered list lines.
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
        if (t.startsWith('## ')) return <p key={i} className="pt-1 text-sm font-semibold text-[var(--ink)]">{inline(t.slice(3), i)}</p>;
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
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function run() {
    setBusy(true);
    try { setData(await reportApi.get()); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  const findings = data?.findings || [];
  const shown = showAll ? findings : findings.slice(0, 6);
  const ai = data?.source === 'ai';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)]">
            <Icon d={['M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z']} className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">AI operations report</p>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">Scans every course for viability, waitlist, and staffing issues — and suggests fixes.</p>
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="At risk" value={data.stats.atRisk} tone={data.stats.atRisk ? 'rose' : undefined} />
            <Stat label="Under minimum" value={data.stats.underfilled} tone={data.stats.underfilled ? 'amber' : undefined} />
            <Stat label="Waitlist alerts" value={data.stats.waitlistAlerts} tone={data.stats.waitlistAlerts ? 'amber' : undefined} />
            <Stat label="Staffing gaps" value={data.stats.staffingGaps} tone={data.stats.staffingGaps ? 'rose' : undefined} />
          </div>

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <Narrative text={data.narrative} />
          </div>

          {findings.length > 0 && (
            <div className="mt-4">
              <p className="lbl mb-2">Suggested fixes</p>
              <div className="space-y-2">
                {shown.map((f, i) => (
                  <div key={i} className="rounded-xl border border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={(SEV[f.severity] || SEV.low).tone}>{(SEV[f.severity] || SEV.low).label}</Badge>
                      <span className="text-sm font-medium text-[var(--ink)]">{f.title}</span>
                      <span className="text-xs text-[var(--ink-3)]">· {f.course}</span>
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--ink-2)]">
                      <Icon d="M13 7l5 5-5 5M6 12h12" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /> {f.action}
                    </p>
                  </div>
                ))}
              </div>
              {findings.length > 6 && (
                <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-[var(--accent-ink)] hover:underline">
                  {showAll ? 'Show fewer' : `Show all ${findings.length} findings`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
