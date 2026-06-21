'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/ui/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi, STATUS_STYLE, statusLabel } from '@/services/data';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function DashboardContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    dashboardApi.get().then((r) => setCourses(r.courses)).catch(() => setCourses([]));
  }, []);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const atRisk = (courses || []).filter((c) => ['compliance_risk', 'staffing_risk', 'viability_risk'].includes(c.compliance.status));
  const ready = (courses || []).filter((c) => c.compliance.status === 'ready');

  return (
    <>
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{greeting()}, {user.firstName}</h1>
        <p className="mt-1 text-sm text-neutral-500">{today}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={courses ? courses.length : '—'} icon="courses" />
        <StatCard label="Need attention" value={courses ? atRisk.length : '—'} icon="pending" hint={atRisk.length ? 'Compliance / staffing gaps' : 'All clear'} />
        <StatCard label="Ready to run" value={courses ? ready.length : '—'} icon="learners" />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">What needs attention</h2>
      <p className="mt-1 text-sm text-neutral-500">Courses are ranked by operational risk.</p>

      <div className="mt-4 space-y-3">
        {courses === null ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-neutral-400">No courses yet. Create one from <Link href="/courses" className="text-teal-700 hover:underline">Courses</Link>.</p>
        ) : (
          courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-teal-300">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {c.courseType || '—'} · {c.confirmedStudents} students
                    {c.startDate ? ` · ${new Date(c.startDate).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.compliance.status] || ''}`}>
                  {statusLabel(c.compliance.status)}
                </span>
              </div>
              {c.compliance.explanation?.length > 0 && (
                <p className="mt-2 text-xs text-neutral-600">{c.compliance.explanation.join('  ')}</p>
              )}
            </Link>
          ))
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
