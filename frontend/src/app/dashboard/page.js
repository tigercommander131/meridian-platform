'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/services/api';
import { useSync } from '@/hooks/useSync';
import { usePersist } from '@/hooks/usePersist';

function SyncBadge() {
  const { isOnline, pendingCount } = useSync();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isOnline ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-teal-600' : 'bg-amber-500'}`} />
      {isOnline ? 'Online' : 'Offline'}
      {pendingCount > 0 && ` · ${pendingCount} queued`}
    </span>
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
        Survives refresh and works with no network.
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setUser(auth.getUser());
  }, [router]);

  function handleLogout() {
    auth.logout();
    router.replace('/login');
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold text-neutral-900">PARASOL EMT</span>
          <div className="flex items-center gap-4">
            <SyncBadge />
            <span className="text-sm text-neutral-600">
              {user.firstName} {user.lastName}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Signed in as {user.email} · Roles: {user.roles.join(', ')}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {['Active Courses', 'Pending Scores', 'Learners'].map((label) => (
            <div
              key={label}
              className="rounded-lg border border-neutral-200 bg-white p-5"
            >
              <p className="text-sm text-neutral-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">—</p>
            </div>
          ))}
        </div>

        <OfflineSelfTest />

        <p className="mt-8 text-xs text-neutral-400">
          Week 1 scaffold. Course data wires up in Week 5.
        </p>
      </main>
    </div>
  );
}
