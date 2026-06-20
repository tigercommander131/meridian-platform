'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { usePersist } from '@/hooks/usePersist';

function OfflineSelfTest() {
  const { create, list } = usePersist();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  async function runTest() {
    setBusy(true);
    try {
      await create('learners', {
        id: `learner_${Date.now()}`,
        first_name: 'Offline',
        last_name: 'Test',
        email: `test${Date.now()}@local`,
      });
      setRows(await list('learners'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-700">Offline storage self-test</p>
      <p className="mt-1 text-xs text-neutral-500">
        Writes a row to the in-browser SQLite DB (persisted to IndexedDB) and reads it back.
      </p>
      <button
        onClick={runTest}
        disabled={busy}
        className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? 'Writing…' : 'Write + read local DB'}
      </button>
      {rows && (
        <p className="mt-3 text-sm text-neutral-700">
          Local <code>learners</code> rows: <strong>{rows.length}</strong>
        </p>
      )}
    </div>
  );
}

function DashboardContent() {
  const { user } = useAuth();

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Signed in as {user.email} · Roles: {user.roles.join(', ')}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {['Active Courses', 'Pending Scores', 'Learners'].map((label) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">—</p>
          </div>
        ))}
      </div>

      <OfflineSelfTest />

      <p className="mt-8 text-xs text-neutral-400">
        Week 2 — auth + app shell. Course data wires up in Week 5.
      </p>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
