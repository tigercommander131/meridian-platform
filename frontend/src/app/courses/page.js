'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { coursesApi, COURSE_STATES } from '@/services/data';
import { toast } from '@/stores/toastStore';

const STATUS = ['active', 'completed', 'archived'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function CreateCourse({ onCreated }) {
  const [name, setName] = useState('');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');
  const [maxLearners, setMax] = useState('24');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error('Course name required');
    setBusy(true);
    try {
      const cap = parseInt(maxLearners, 10);
      await coursesApi.create({
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        maxLearners: Number.isInteger(cap) ? cap : undefined,
      });
      toast.success(`Course "${name.trim()}" created`);
      setName(''); setStart(''); setEnd(''); setMax('24');
      onCreated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const field = 'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600';

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-700">New course</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs text-neutral-500">Course name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ALS — June 2026 Batch A" className={field} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Max learners</label>
          <input type="number" min="1" value={maxLearners} onChange={(e) => setMax(e.target.value)} className={field} />
        </div>
      </div>
      <button onClick={submit} disabled={busy}
        className="mt-4 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
        {busy ? 'Creating…' : 'Create course'}
      </button>
    </div>
  );
}

function CourseCard({ course, onChanged }) {
  const state = COURSE_STATES[course.status] || COURSE_STATES.active;

  async function setStatus(status) {
    try {
      await coursesApi.update(course.id, { status });
      toast.success(`"${course.name}" → ${status}`);
      onChanged();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{course.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{fmtDate(course.startDate)} – {fmtDate(course.endDate)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${state.cls}`}>{state.label}</span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
        <span>{course.cohortCount ?? 0} cohort(s)</span>
        <span>Cap {course.maxLearners}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
        <Link href={`/cohorts?course=${course.id}`}
          className="text-sm font-medium text-teal-700 hover:text-teal-800">Manage cohorts →</Link>
        <select value={course.status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 outline-none focus:border-teal-600">
          {STATUS.map((s) => <option key={s} value={s}>{COURSE_STATES[s].label}</option>)}
        </select>
      </div>
    </div>
  );
}

function CoursesContent() {
  const [courses, setCourses] = useState([]);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (status) => {
    setLoading(true);
    try {
      const res = await coursesApi.list(status || undefined);
      setCourses(res.courses);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Create a course, then group learners into cohorts and run sessions."
        action={
          <button onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
            {showCreate ? 'Close' : 'New course'}
          </button>
        }
      />

      {showCreate && (
        <div className="mt-4">
          <CreateCourse onCreated={() => { setShowCreate(false); load(filter); }} />
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <span className="text-xs text-neutral-500">Filter</span>
        {[['', 'All'], ...STATUS.map((s) => [s, COURSE_STATES[s].label])].map(([val, label]) => (
          <button key={val || 'all'} onClick={() => setFilter(val)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === val ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : courses.length === 0 ? (
          <EmptyState
            icon="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5"
            title="No courses yet"
            message="Create your first course to start grouping learners into cohorts."
            action={
              <button onClick={() => setShowCreate(true)}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
                New course
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} course={c} onChanged={() => load(filter)} />)}
          </div>
        )}
      </div>
    </>
  );
}

export default function CoursesPage() {
  return (
    <AppShell>
      <CoursesContent />
    </AppShell>
  );
}
