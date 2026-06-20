'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/ui/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { toast } from '@/stores/toastStore';
import { coursesApi, learnersApi } from '@/services/data';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const QUICK_ACTIONS = [
  { href: '/students', label: 'Add students', desc: 'Import or enrol learners', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0' },
  { href: '/sessions', label: 'Run a session', desc: 'Check in, score a simulation', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/reports', label: 'View reports', desc: 'Released results + PDF export', icon: 'M9 17v-6h6v6M4 4h16v16H4z' },
];

function LiveActivity() {
  const { connection, events } = useRealtimeStore();
  const dot =
    connection === 'connected' ? 'bg-teal-500' : connection === 'connecting' ? 'bg-amber-400' : 'bg-neutral-300';

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-sm font-medium text-neutral-700">Live activity</p>
        <span className="text-xs text-neutral-400">({connection})</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">
          No live events yet. Sync from another window to see updates appear here in real time.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-xs">
              <span className="text-neutral-700">
                {e.type === 'events.synced'
                  ? `${e.payload?.count} event(s) synced by ${e.payload?.by}`
                  : e.type}
              </span>
              <span className="text-neutral-400">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LABEL = {
  idle: 'Idle',
  pending: 'Pending sync',
  syncing: 'Syncing…',
  synced: 'All synced',
  error: 'Needs attention',
};

function SyncPanel() {
  const { isOnline, syncStatus, pendingCount, conflicts, sync, resolve } = useSync();
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(null);

  async function handleResolve(eventId, choice) {
    setResolving(eventId + choice);
    try {
      const r = await resolve(eventId, choice);
      if (r.ok) toast.success(choice === 'mine' ? 'Your version was forced through' : 'Kept the server version');
      else toast.error(`Could not resolve: ${r.reason}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setResolving(null);
    }
  }

  async function handleSync() {
    setBusy(true);
    try {
      const result = await sync();
      if (result?.conflicts?.length > 0) {
        toast.error(`${result.conflicts.length} conflict(s) need manual review`);
      } else if (result?.synced > 0) {
        toast.success(`Synced ${result.synced} event(s) to the cloud`);
      }
    } catch {
      toast.error('Sync failed — will retry automatically');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
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
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'} — choose which version to keep
          </p>
          <ul className="mt-3 space-y-3">
            {conflicts.map((c) => (
              <li key={c.eventId} className="rounded-md border border-amber-200 bg-white p-3">
                <p className="text-xs text-neutral-600">
                  This score was finalized on the server while you edited it offline.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-neutral-200 p-2">
                    <p className="text-neutral-400">Server ({c.serverVersion?.state})</p>
                    <p className="text-lg font-semibold text-neutral-800">{c.serverVersion?.totalScore}</p>
                  </div>
                  <div className="rounded border border-neutral-200 p-2">
                    <p className="text-neutral-400">Your offline edit</p>
                    <p className="text-lg font-semibold text-neutral-800">{c.clientVersion?.totalScore}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleResolve(c.eventId, 'server')}
                    disabled={resolving === c.eventId + 'server'}
                    className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Keep server
                  </button>
                  <button
                    onClick={() => handleResolve(c.eventId, 'mine')}
                    disabled={resolving === c.eventId + 'mine'}
                    className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Use my version
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { pendingCount } = useSync();
  const [stats, setStats] = useState({ courses: '—', learners: '—' });

  useEffect(() => {
    (async () => {
      try {
        const [c, l] = await Promise.all([coursesApi.list(), learnersApi.list({ limit: 1 })]);
        setStats({
          courses: c.courses.filter((x) => x.status === 'active').length,
          learners: l.total,
        });
      } catch {
        // leave placeholders
      }
    })();
  }, []);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {greeting()}, {user.firstName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{today}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={stats.courses} icon="courses" />
        <StatCard label="Learners" value={stats.learners} icon="learners" />
        <StatCard label="Queued offline" value={pendingCount} icon="pending" hint={pendingCount ? 'Will sync when online' : 'All synced'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-teal-300 hover:bg-teal-50/40">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-teal-100 group-hover:text-teal-700">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>
            </span>
            <span>
              <span className="block text-sm font-medium text-neutral-800">{a.label}</span>
              <span className="block text-xs text-neutral-500">{a.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SyncPanel />
        <LiveActivity />
      </div>
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
