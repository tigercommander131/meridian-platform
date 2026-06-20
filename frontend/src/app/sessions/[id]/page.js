'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ScoresPanel from '@/components/scoring/ScoresPanel';
import { sessionsApi, ROLES } from '@/services/data';
import { toast } from '@/stores/toastStore';

const STATUS_STYLE = {
  created: 'bg-neutral-100 text-neutral-600',
  active: 'bg-teal-50 text-teal-700',
  completed: 'bg-neutral-100 text-neutral-500',
};

function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);

  const load = useCallback(async () => {
    setSession(await sessionsApi.get(id));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function act(fn, ok) {
    try { await fn(); toast.success(ok); load(); }
    catch (e) { toast.error(e.message); }
  }

  if (!session) return <p className="text-sm text-neutral-500">Loading…</p>;

  const started = session.status !== 'created';

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{session.scenarioId}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {session.participants.filter((p) => p.checkinStatus === 'checked_in').length}/{session.participants.length} checked in
            · {session.flightRecorderEventCount} events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[session.status]}`}>{session.status}</span>
          {session.status === 'created' && (
            <button onClick={() => act(() => sessionsApi.start(id), 'Session started')}
              className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
              Start
            </button>
          )}
          {session.status === 'active' && (
            <button onClick={() => act(() => sessionsApi.end(id), 'Session ended')}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
              End
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Learner</th>
              <th className="px-4 py-2 font-medium">Check-in</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {session.participants.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-800">{p.learnerName}</td>
                <td className="px-4 py-2">
                  {p.checkinStatus === 'checked_in' ? (
                    <span className="text-teal-700">Checked in</span>
                  ) : (
                    <button onClick={() => act(() => sessionsApi.checkin(id, p.id, 'manual'), 'Checked in')}
                      disabled={started}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-40">
                      Check in
                    </button>
                  )}
                </td>
                <td className="px-4 py-2">
                  <select value={p.role || ''} onChange={(e) => act(() => sessionsApi.assignRole(id, p.id, e.target.value), 'Role set')}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
                    <option value="">—</option>
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => act(
                      () => sessionsApi.ingestEvent(id, {
                        participantId: p.id,
                        eventType: 'compression_detected',
                        parameters: { compressionDepthMM: 52, rateBPM: 108, timeToFirstCompression: 11 },
                      }),
                      'Demo evidence added'
                    )}
                    className="mr-2 text-xs text-neutral-400 hover:text-neutral-600"
                    title="Simulate flight-recorder data (no real simulator attached)"
                  >
                    + evidence
                  </button>
                  <Link href={`/scoring/${id}/${p.id}`}
                    className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700">
                    Score
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">Scores</h2>
      <p className="mb-3 mt-0.5 text-xs text-neutral-400">Approve → release to learners. Disputes reopen for re-review.</p>
      <ScoresPanel sessionId={id} />

      <Link href="/sessions" className="mt-6 inline-block text-sm text-teal-700 hover:underline">← All sessions</Link>
    </>
  );
}

export default function SessionDetailPage() {
  return (
    <AppShell>
      <SessionDetail />
    </AppShell>
  );
}
