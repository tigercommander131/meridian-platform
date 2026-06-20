'use client';

import { useEffect, useState, useCallback } from 'react';
import StudentShell from '@/components/layout/StudentShell';
import { studentApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

function Timetable() {
  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await studentApi.sessions();
      setSessions(r.sessions);
    } catch (e) {
      toast.error(e.message);
      setSessions([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function checkin(id) {
    setBusy(id);
    try {
      await studentApi.checkin(id);
      toast.success('Checked in');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (!sessions) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">My sessions</h1>
      <p className="mt-1 text-sm text-neutral-500">Your simulation sessions. Tap “Check in” when you arrive.</p>

      {sessions.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No sessions scheduled yet — your trainer will add them.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{s.scenario}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {s.course} · {s.cohort}{s.role ? ` · ${s.role.replace(/_/g, ' ')}` : ''}
                  </p>
                  {s.scheduledStart && (
                    <p className="mt-0.5 text-xs text-neutral-400">{new Date(s.scheduledStart).toLocaleString()}</p>
                  )}
                </div>
                {s.checkinStatus === 'checked_in' ? (
                  <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">Checked in</span>
                ) : (
                  <button
                    onClick={() => checkin(s.id)}
                    disabled={busy === s.id}
                    className="shrink-0 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {busy === s.id ? '…' : 'Check in'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function PortalPage() {
  return (
    <StudentShell>
      <Timetable />
    </StudentShell>
  );
}
