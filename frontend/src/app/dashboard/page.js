'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, Skeleton, Icon } from '@/components/ui/kit';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi, fmtDate } from '@/services/data';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const RISK = ['compliance_risk', 'staffing_risk', 'viability_risk'];
const RAIL = { compliance_risk: 'bg-rose-400', staffing_risk: 'bg-amber-400', viability_risk: 'bg-amber-400', ready: 'bg-teal-400', planning: 'bg-neutral-300' };

function CourseRow({ c }) {
  return (
    <Link href={`/courses/${c.id}`}
      className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-[var(--line)] bg-white p-4 transition-all hover:border-teal-300 hover:shadow-card">
      <span className={`absolute left-0 top-0 h-full w-1 ${RAIL[c.compliance.status] || 'bg-neutral-300'}`} />
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{c.name}</p>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">
              {c.courseType || 'No course type'} · {c.confirmedStudents} students{c.startDate ? ` · ${fmtDate(c.startDate)}` : ''}
            </p>
          </div>
          <StatusBadge status={c.compliance.status} className="shrink-0" />
        </div>
        {c.compliance.explanation?.length > 0 && (
          <p className="mt-2 text-xs text-[var(--ink-2)]">{c.compliance.explanation.slice(0, 3).join('  ')}</p>
        )}
      </div>
      <Icon d="M9 6l6 6-6 6" className="mt-1 h-4 w-4 shrink-0 text-[var(--ink-3)] opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    dashboardApi.get().then((r) => setCourses(r.courses)).catch(() => setCourses([]));
  }, []);

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const list = courses || [];
  const atRisk = list.filter((c) => RISK.includes(c.compliance.status));
  const ready = list.filter((c) => c.compliance.status === 'ready');

  return (
    <>
      <div className="border-b border-[var(--line)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{greeting()}, {user.firstName}</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">{today} · Here’s what needs your attention.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={courses ? list.length : '—'} icon="courses" tone="neutral" />
        <StatCard label="Need attention" value={courses ? atRisk.length : '—'} icon="pending" tone={atRisk.length ? 'amber' : 'neutral'} hint={courses ? (atRisk.length ? 'Compliance / staffing gaps' : 'All clear') : ''} />
        <StatCard label="Ready to run" value={courses ? ready.length : '—'} icon="ready" tone="teal" />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">What needs attention</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-3)]">Courses ranked by operational risk.</p>
        </div>
        <Link href="/courses" className="text-sm font-medium text-teal-700 hover:underline">All courses →</Link>
      </div>

      <div className="mt-4 space-y-3">
        {courses === null ? (
          <>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</>
        ) : list.length === 0 ? (
          <Card className="text-center text-sm text-[var(--ink-3)]">
            No courses yet. Create one from <Link href="/courses" className="font-medium text-teal-700 hover:underline">Courses</Link>.
          </Card>
        ) : (
          [...atRisk, ...list.filter((c) => !RISK.includes(c.compliance.status))].map((c) => <CourseRow key={c.id} c={c} />)
        )}
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
