'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import QrScanner from '@/components/shared/QrScanner';
import { coursesApi, cohortsApi, sessionsApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

const STATUS_STYLE = {
  created: 'bg-neutral-100 text-neutral-600',
  active: 'bg-teal-50 text-teal-700',
  completed: 'bg-neutral-100 text-neutral-500',
};

function SessionsContent() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [scenario, setScenario] = useState('scenario_vf_adult');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  function handleScan(code) {
    setScanning(false);
    if (code.startsWith('SESSION_')) router.push(`/sessions/${code.slice('SESSION_'.length)}`);
    else if (code.startsWith('COHORT_')) router.push(`/cohorts/${code.slice('COHORT_'.length)}`);
    else toast.error(`Unrecognised code: ${code}`);
  }

  useEffect(() => {
    (async () => {
      const c = await coursesApi.list();
      const lists = await Promise.all(c.courses.map((co) => cohortsApi.listForCourse(co.id)));
      const flat = [];
      c.courses.forEach((co, i) => {
        lists[i].cohorts.forEach((ch) => flat.push({ id: ch.id, label: `${ch.name} · ${co.name}` }));
      });
      setCohorts(flat);
      if (flat[0]) setCohortId(flat[0].id);
    })();
  }, []);

  const loadSessions = useCallback(async (cid) => {
    if (!cid) return;
    const res = await sessionsApi.listForCohort(cid);
    setSessions(res.sessions);
  }, []);

  useEffect(() => { loadSessions(cohortId); }, [cohortId, loadSessions]);

  async function createSession() {
    if (!cohortId) return toast.error('Pick a cohort first');
    setBusy(true);
    try {
      await sessionsApi.create(cohortId, { scenarioId: scenario });
      toast.success('Session created');
      loadSessions(cohortId);
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
          <h1 className="text-xl font-semibold text-neutral-900">Sessions</h1>
          <p className="mt-1 text-sm text-neutral-500">Run a simulation: check in learners, assign roles, score.</p>
        </div>
        <button onClick={() => setScanning(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
          Scan QR
        </button>
      </div>

      {scanning && <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-500">Cohort</label>
          <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}
            className="mt-1 block w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Scenario</label>
          <input value={scenario} onChange={(e) => setScenario(e.target.value)}
            className="mt-1 block w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </div>
        <button onClick={createSession} disabled={busy}
          className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create session'}
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-400">No sessions for this cohort yet.</p>
        ) : (
          sessions.map((s) => (
            <Link key={s.id} href={`/sessions/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-teal-300">
              <div>
                <span className="text-sm font-medium text-neutral-800">{s.scenarioId}</span>
                <span className="ml-3 text-xs text-neutral-400">{s.checkedIn}/{s.total} checked in</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] || ''}`}>{s.status}</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

export default function SessionsPage() {
  return (
    <AppShell>
      <SessionsContent />
    </AppShell>
  );
}
