'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import QrScanner from '@/components/shared/QrScanner';
import { coursesApi, cohortsApi, sessionsApi, scenariosApi } from '@/services/data';
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
  const [scenarios, setScenarios] = useState([]);
  const [scenarioId, setScenarioId] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  function handleScan(code) {
    setScanning(false);
    let target = null;
    if (/^https?:\/\//i.test(code)) {
      // QR posters encode a full URL (so a phone's native camera works too).
      try { target = new URL(code).pathname; } catch { /* not a URL */ }
    } else if (code.startsWith('SESSION_')) {
      target = `/sessions/${code.slice('SESSION_'.length)}`;
    } else if (code.startsWith('COHORT_')) {
      target = `/cohorts/${code.slice('COHORT_'.length)}`;
    }
    if (target && /^\/(sessions|cohorts)\/[^/]+$/.test(target)) router.push(target);
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
      const sc = await scenariosApi.list();
      setScenarios(sc.scenarios || []);
      if (sc.scenarios?.[0]) setScenarioId(sc.scenarios[0].scenarioId);
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
    if (!scenarioId) return toast.error('Pick a scenario');
    setBusy(true);
    try {
      const sc = scenarios.find((s) => s.scenarioId === scenarioId);
      await sessionsApi.create(cohortId, { scenarioId, scenarioName: sc?.name });
      toast.success('Session created');
      loadSessions(cohortId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const groupedScenarios = scenarios.reduce((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Run a simulation: check in learners, assign roles, score."
        action={
          <button onClick={() => setScanning(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 12h10" /></svg>
            Scan QR
          </button>
        }
      />

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
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}
            className="mt-1 block w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm">
            {scenarios.length === 0 && <option value="">No scenarios yet</option>}
            {Object.entries(groupedScenarios).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map((s) => <option key={s.scenarioId} value={s.scenarioId}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
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
                <span className="text-sm font-medium text-neutral-800">{s.scenarioName || s.scenarioId}</span>
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
