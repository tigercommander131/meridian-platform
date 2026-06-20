'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { usePersist } from '@/hooks/usePersist';
import { useSync } from '@/hooks/useSync';

const STATUS_LABEL = {
  idle: 'Idle',
  pending: 'Pending sync',
  syncing: 'Syncing…',
  synced: 'All synced',
  error: 'Needs attention',
};

function SyncPanel() {
  const { isOnline, syncStatus, pendingCount, conflicts, sync } = useSync();
  const [busy, setBusy] = useState(false);

  async function handleSync() {
    setBusy(true);
    try {
      await sync();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-700">Cloud sync</p>
          <p className="mt-1 text-xs text-neutral-500">
            {STATUS_LABEL[syncStatus] || syncStatus}
            {pendingCount > 0 && ` · ${pendingCount} event${pendingCount === 1 ? '' : 's'} queued`}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={busy || !isOnline || pendingCount === 0}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
          title={!isOnline ? 'Offline — will sync when back online' : pendingCount === 0 ? 'Nothing to sync' : 'Push queued events to the cloud'}
        >
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-md bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'} — manual review required
          </p>
          <ul className="mt-2 space-y-1">
            {conflicts.map((c) => (
              <li key={c.eventId} className="text-xs text-amber-700">
                {c.conflictType}: server {c.serverVersion?.totalScore} vs local {c.clientVersion?.totalScore}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
      <SyncPanel />

      <p className="mt-8 text-xs text-neutral-400">
        Week 3 — offline→cloud sync. Course data wires up in Week 5.
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
