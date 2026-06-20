'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { scoringApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

function ScoringContent() {
  const { sessionId, participantId } = useParams();
  const router = useRouter();
  const [ctx, setCtx] = useState(null);
  const [scores, setScores] = useState({}); // { criterionId: { points, notes } }
  const [assessorNotes, setAssessorNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCtx(await scoringApi.context(sessionId, participantId));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [sessionId, participantId]);

  function setPoints(cId, points, max) {
    const n = Math.max(0, Math.min(Number(points) || 0, max));
    setScores((s) => ({ ...s, [cId]: { ...s[cId], points: n } }));
  }
  function setNotes(cId, notes) {
    setScores((s) => ({ ...s, [cId]: { ...s[cId], notes } }));
  }

  if (error) return <p className="text-sm text-amber-700">{error}</p>;
  if (!ctx) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!ctx.rubric) return <p className="text-sm text-amber-700">No rubric found for this scenario/role.</p>;

  const total = Object.values(scores).reduce((sum, s) => sum + (Number(s.points) || 0), 0);
  const maxTotal = ctx.rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  async function save() {
    setBusy(true);
    try {
      const res = await scoringApi.submit(sessionId, participantId, {
        rubricId: ctx.rubric.id,
        scores,
        assessorNotes,
      });
      toast.success(`Score saved: ${res.totalScore} (pending approval)`);
      router.push(`/sessions/${sessionId}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{ctx.participant.learnerName}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {ctx.rubric.name}{ctx.participant.role ? ` · ${ctx.participant.role.replace('_', ' ')}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-neutral-900">{total}<span className="text-base text-neutral-400">/{maxTotal}</span></p>
          <p className="text-xs text-neutral-400">live total</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {ctx.rubric.criteria.map((c) => {
          const ev = c.evidenceField ? ctx.evidence[c.evidenceField] : undefined;
          return (
            <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{c.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{c.description}</p>
                  {c.evidenceField && (
                    <p className="mt-2 inline-block rounded bg-teal-50 px-2 py-1 text-xs text-teal-700">
                      Evidence: {c.evidenceField.replace('flightRecorder.', '')} ={' '}
                      <strong>{ev !== undefined ? String(ev) : 'no data'}</strong>
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <input type="number" min={0} max={c.maxPoints}
                    value={scores[c.id]?.points ?? ''}
                    onChange={(e) => setPoints(c.id, e.target.value, c.maxPoints)}
                    className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-right text-sm" />
                  <p className="mt-1 text-xs text-neutral-400">/ {c.maxPoints}</p>
                </div>
              </div>
              <input
                value={scores[c.id]?.notes ?? ''}
                onChange={(e) => setNotes(c.id, e.target.value)}
                placeholder="Notes (optional)"
                className="mt-3 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm" />
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
        <label className="text-sm font-medium text-neutral-700">Overall assessor notes</label>
        <textarea value={assessorNotes} onChange={(e) => setAssessorNotes(e.target.value)} rows={3}
          className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save score'}
        </button>
        <Link href={`/sessions/${sessionId}`} className="text-sm text-neutral-500 hover:underline">Cancel</Link>
      </div>
    </>
  );
}

export default function ScoringPage() {
  return (
    <AppShell>
      <ScoringContent />
    </AppShell>
  );
}
