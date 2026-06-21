'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { Skeleton, Icon } from '@/components/ui/kit';
import { FlightStatus, Lamp } from '@/components/ui/aviation';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi, fmtDate, flight, station } from '@/services/data';

function useClock() {
  const [t, setT] = useState(null);
  useEffect(() => { const f = () => setT(new Date()); f(); const i = setInterval(f, 1000); return () => clearInterval(i); }, []);
  return t;
}

function relDays(d) {
  if (!d) return '';
  const days = Math.round((new Date(d) - new Date()) / 86400000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
}

function Tile({ label, value, lamp, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        {lamp && <Lamp kind={lamp} pulse />}
        <p className="lbl">{label}</p>
      </div>
      <p className="mt-2 font-mono text-3xl font-bold tnum tracking-tight text-[var(--ink)]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

function BoardRow({ c }) {
  const f = flight(c.compliance.status);
  const short = c.crew && c.crew.assigned < c.crew.required;
  const code = `${c.courseTypeCode || 'CRS'}·${station(c.region)}`;
  return (
    <Link href={`/courses/${c.id}`}
      className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 border-b border-[var(--board-line)] px-4 py-3 transition-colors hover:bg-[var(--board-2)] sm:grid-cols-[9rem_1fr_5rem_7rem_5rem_8rem]">
      <span className="font-mono text-sm font-bold tracking-wide text-board-ink">{code}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-board-ink">{c.name}</span>
        <span className="block truncate text-[11px] text-board-ink/50 sm:hidden">{station(c.region)} · {fmtDate(c.startDate, { day: 'numeric', month: 'short' })} · crew {c.crew?.assigned}/{c.crew?.required}</span>
      </span>
      <span className="hidden font-mono text-sm text-board-ink/70 sm:block">{station(c.region)}</span>
      <span className="hidden font-mono text-sm text-board-ink/70 sm:block">
        {fmtDate(c.startDate, { day: '2-digit', month: 'short' })}
        <span className="block text-[10px] text-board-ink/40">{relDays(c.startDate)}</span>
      </span>
      <span className={`hidden font-mono text-sm tnum sm:block ${short ? 'text-[var(--lamp-warn)]' : 'text-board-ink/70'}`}>{c.crew?.assigned}/{c.crew?.required}</span>
      <span className="justify-self-end sm:justify-self-start"><FlightStatus status={c.compliance.status} onBoard /></span>
    </Link>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const clock = useClock();

  useEffect(() => { dashboardApi.get().then((r) => setCourses(r.courses)).catch(() => setCourses([])); }, []);

  const list = courses || [];
  const cleared = list.filter((c) => c.compliance.status === 'ready').length;
  const atRisk = list.filter((c) => ['compliance_risk', 'staffing_risk', 'viability_risk'].includes(c.compliance.status)).length;
  const gaps = list.reduce((n, c) => n + (c.crew ? Math.max(0, c.crew.required - c.crew.assigned) : 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-5">
        <div>
          <p className="lbl">Operations board</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">Good {clock && clock.getHours() < 12 ? 'morning' : clock && clock.getHours() < 18 ? 'afternoon' : 'evening'}, {user.firstName}</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold tnum text-[var(--ink)]">{clock ? clock.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--'}</p>
          <p className="text-xs text-[var(--ink-3)]">{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Active" value={courses ? list.length : '—'} />
        <Tile label="Cleared" value={courses ? cleared : '—'} lamp="go" />
        <Tile label="At risk" value={courses ? atRisk : '—'} lamp={atRisk ? 'stop' : 'idle'} />
        <Tile label="Crew gaps" value={courses ? gaps : '—'} lamp={gaps ? 'warn' : 'idle'} hint={gaps ? 'roles unfilled' : 'fully crewed'} />
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--board-line)] bg-board board-grid shadow-soft">
        <div className="flex items-center justify-between border-b border-[var(--board-line)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Icon d={['M3 12h3l2-5 4 10 2-5h7']} className="h-5 w-5 text-[var(--accent)]" strokeWidth={2} />
            <span className="font-mono text-sm font-bold tracking-widest text-board-ink">DEPARTURES</span>
          </div>
          <div className="hidden items-center gap-3 font-mono text-[10px] text-board-ink/50 sm:flex">
            <span className="flex items-center gap-1"><Lamp kind="go" /> CLEARED</span>
            <span className="flex items-center gap-1"><Lamp kind="warn" /> WATCH</span>
            <span className="flex items-center gap-1"><Lamp kind="stop" /> AT RISK</span>
          </div>
        </div>

        <div className="hidden grid-cols-[9rem_1fr_5rem_7rem_5rem_8rem] gap-3 border-b border-[var(--board-line)] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-board-ink/40 sm:grid">
          <span>Flight</span><span>Course</span><span>Route</span><span>Date</span><span>Crew</span><span>Status</span>
        </div>

        {courses === null ? (
          <div className="space-y-px p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full bg-white/5" />)}</div>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center font-mono text-sm text-board-ink/50">NO SCHEDULED DEPARTURES — create a course to begin.</p>
        ) : (
          [...list].sort((a, b) => (flight(a.compliance.status).lamp === 'stop' ? -1 : 0) - (flight(b.compliance.status).lamp === 'stop' ? -1 : 0))
            .map((c) => <BoardRow key={c.id} c={c} />)
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <Link href="/courses" className="text-sm font-medium text-[var(--accent-ink)] hover:underline">Manage all courses →</Link>
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
