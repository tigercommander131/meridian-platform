'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { Skeleton, Icon, Button } from '@/components/ui/kit';
import { FlightStatus, Lamp } from '@/components/ui/aviation';
import OpsReport from '@/components/ops/OpsReport';
import CourseFilters from '@/components/ui/CourseFilters';
import ColumnPicker from '@/components/ui/ColumnPicker';
import AdaptableCourseTable from '@/components/ops/AdaptableCourseTable';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi, fmtDate, fmtDateRange, flight, station, emptyCourseFilter, courseFilterActive, COURSE_WINDOWS,
  buildFields, DEFAULT_BOARD_COLS, loadCols, saveCols } from '@/services/data';

function useClock() {
  const [t, setT] = useState(null);
  useEffect(() => { const f = () => setT(new Date()); f(); const i = setInterval(f, 1000); return () => clearInterval(i); }, []);
  return t;
}

const GRID = 'grid-cols-[7rem_1fr_auto] sm:grid-cols-[6.5rem_7rem_8.5rem_4.5rem_4.5rem_4rem_7rem]';

function Tile({ label, value, lamp, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">{lamp && <Lamp kind={lamp} pulse />}<p className="lbl">{label}</p></div>
      <p className="mt-2 font-mono text-3xl font-bold tnum tracking-tight text-[var(--ink)]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

function CourseRow({ c }) {
  const code = c.courseTypeCode || (c.courseType || 'Course');
  const instrShort = c.crew && c.crew.instructors < c.crew.instructorsRequired;
  const min = c.groups ? 4 * c.groups : null;
  const studShort = min != null && c.confirmedStudents < min;
  const wl = c.waitlistCount || 0;
  return (
    <Link href={`/courses/${c.id}`}
      className={`grid ${GRID} items-center gap-3 border-b border-[var(--board-line)] px-4 py-3 transition-colors hover:bg-[var(--board-2)]`}>
      {/* Course */}
      <span className="min-w-0">
        <span className="block font-mono text-sm font-bold text-board-ink">{code}</span>
        {c.externalRef && <span className="block font-mono text-[10px] text-[var(--board-ink-2)]">{c.externalRef}</span>}
      </span>
      {/* Location (+ mobile meta) */}
      <span className="min-w-0">
        <span className="block truncate text-sm text-board-ink">{c.region || c.name}</span>
        <span className="block truncate text-[11px] text-[var(--board-ink-2)] sm:hidden">
          {fmtDateRange(c.startDate, c.endDate)} · {c.confirmedStudents}/{c.capacity} stu · {c.crew?.instructors}/{c.crew?.instructorsRequired} inst{wl ? ` · WL ${wl}` : ''}
        </span>
      </span>
      {/* Date */}
      <span className="hidden font-mono text-xs text-[var(--board-ink-2)] sm:block">{fmtDateRange(c.startDate, c.endDate)}</span>
      {/* Instructors */}
      <span className={`hidden font-mono text-sm tnum sm:block ${instrShort ? 'text-[var(--lamp-warn)]' : 'text-board-ink'}`}>{c.crew?.instructors}/{c.crew?.instructorsRequired}</span>
      {/* Students */}
      <span className={`hidden font-mono text-sm tnum sm:block ${studShort ? 'text-[var(--lamp-warn)]' : 'text-board-ink'}`}>{c.confirmedStudents}/{c.capacity}</span>
      {/* Waitlist */}
      <span className={`hidden font-mono text-sm tnum sm:block ${wl >= 6 ? 'text-[var(--lamp-warn)]' : wl > 0 ? 'text-board-ink' : 'text-[var(--board-ink-2)]'}`}>{wl}</span>
      {/* Status */}
      <span className="justify-self-end sm:justify-self-start"><FlightStatus status={c.compliance.status} onBoard /></span>
    </Link>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [data, setData] = useState(null);   // { courses, total, stats, facets, fieldKeys }
  const [limit, setLimit] = useState(25);
  const [filter, setFilter] = useState(emptyCourseFilter());
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState(null);
  const clock = useClock();

  // Server-side: filter + sort + paginate happen in SQL; we fetch one page.
  const fetchPage = useCallback(async (f, lim) => {
    setLoading(true);
    const days = COURSE_WINDOWS.find((w) => w.key === f.when)?.days ?? null;
    try {
      const r = await dashboardApi.get({ limit: lim, offset: 0, q: f.q, type: f.type, region: f.region, status: f.status, window: days ?? undefined });
      setData(r);
    } catch { setData({ courses: [], total: 0, stats: {}, facets: {}, fieldKeys: [] }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchPage(filter, limit); }, [filter, limit, fetchPage]);

  const onFilter = (v) => { setLimit(25); setFilter(v); };

  const list = data?.courses || [];
  const stats = data?.stats || {};
  const total = data?.total ?? 0;
  const hasAttrs = (data?.fieldKeys?.length || 0) > 0;
  const fields = useMemo(() => (hasAttrs ? buildFields(data?.fieldKeys, list) : []), [hasAttrs, data]);
  const colKey = `ctop:boardcols:${user.organisationId}`;
  useEffect(() => {
    if (!hasAttrs || cols !== null || fields.length === 0) return;
    const present = new Set(fields.map((f) => f.key));
    const def = DEFAULT_BOARD_COLS.filter((k) => present.has(k));
    setCols(loadCols(colKey, def.length ? def : fields.slice(0, 6).map((f) => f.key)));
  }, [hasAttrs, fields, cols, colKey]);
  const setColsPersist = (next) => { setCols(next); saveCols(colKey, next); };
  const shown = list;  // server already returns the page in risk order

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
        <Tile label="Active" value={data ? stats.total : '—'} />
        <Tile label="Cleared" value={data ? stats.cleared : '—'} lamp="go" />
        <Tile label="At risk" value={data ? stats.atRisk : '—'} lamp={stats.atRisk ? 'stop' : 'idle'} />
        <Tile label="Waitlisted" value={data ? stats.waitlisted : '—'} lamp={stats.waitlisted ? 'warn' : 'idle'} hint={stats.waitlisted ? 'students waiting' : 'none waiting'} />
      </div>

      {/* AI operations report */}
      <div className="mt-6"><OpsReport /></div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--board-line)] bg-board board-grid shadow-soft">
        <div className="flex items-center justify-between border-b border-[var(--board-line)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Icon d={['M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5']} className="h-5 w-5 text-[var(--accent)]" strokeWidth={2} />
            <span className="font-mono text-sm font-bold tracking-widest text-board-ink">COURSES</span>
            {data && <span className="font-mono text-[11px] text-[var(--board-ink-2)]">{total}</span>}
          </div>
          <div className="flex items-center gap-3">
            {hasAttrs && cols && <ColumnPicker fields={fields} value={cols} onChange={setColsPersist} variant="board" max={10} />}
            <div className="hidden items-center gap-3 font-mono text-[10px] text-[var(--board-ink-2)] sm:flex">
              <span className="flex items-center gap-1"><Lamp kind="go" /> CLEARED</span>
              <span className="flex items-center gap-1"><Lamp kind="warn" /> WATCH</span>
              <span className="flex items-center gap-1"><Lamp kind="stop" /> AT RISK</span>
            </div>
          </div>
        </div>

        {data && (
          <CourseFilters value={filter} onChange={onFilter} options={data.facets} variant="board" count={list.length} total={total} />
        )}

        {!hasAttrs && (
          <div className={`hidden ${GRID} gap-3 border-b border-[var(--board-line)] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--board-ink-2)] sm:grid`}>
            <span>Course</span><span>Location</span><span>Date</span><span>Instructors</span><span>Students</span><span>Waitlist</span><span>Status</span>
          </div>
        )}

        {!data ? (
          <div className="space-y-px p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full bg-white/5" />)}</div>
        ) : total === 0 ? (
          <p className="px-4 py-10 text-center font-mono text-sm text-[var(--board-ink-2)]">{courseFilterActive(filter) ? 'NO MATCH — adjust the filters.' : 'NO COURSES — create one to begin.'}</p>
        ) : hasAttrs ? (
          cols && <AdaptableCourseTable courses={shown} fields={fields} cols={cols} />
        ) : (
          shown.map((c) => <CourseRow key={c.id} c={c} />)
        )}

        {data && total > 25 && (
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            {list.length < total && <button onClick={() => setLimit((n) => n + 25)} className="font-mono text-xs text-[var(--board-ink-2)] hover:text-board-ink">SHOW MORE</button>}
            {list.length < total && <button onClick={() => setLimit(total)} className="font-mono text-xs text-[var(--board-ink-2)] hover:text-board-ink">· SHOW ALL ·</button>}
            {limit > 25 && <button onClick={() => setLimit(25)} className="font-mono text-xs text-[var(--board-ink-2)] hover:text-board-ink">SHOW LESS</button>}
            <span className="font-mono text-[10px] text-[var(--board-ink-2)]">showing {list.length}/{total}{loading ? ' …' : ''}</span>
          </div>
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
