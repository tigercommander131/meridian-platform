'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { coursesApi, accreditationApi, STATUS_STYLE, statusLabel } from '@/services/data';
import { toast } from '@/stores/toastStore';

const field = 'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600';

function CreateCourse({ accreditation, onCreated }) {
  const [name, setName] = useState('');
  const [accreditationOrgId, setAccredId] = useState('');
  const [courseTypeId, setCourseTypeId] = useState('');
  const [courseTypes, setCourseTypes] = useState([]);
  const [confirmedStudents, setStudents] = useState('0');
  const [capacity, setCapacity] = useState('24');
  const [startDate, setStart] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accreditationOrgId) { setCourseTypes([]); setCourseTypeId(''); return; }
    accreditationApi.listCourseTypes(accreditationOrgId).then((r) => setCourseTypes(r.courseTypes));
  }, [accreditationOrgId]);

  async function submit() {
    if (!name.trim()) return toast.error('Course name required');
    setBusy(true);
    try {
      await coursesApi.create({
        name: name.trim(),
        accreditationOrgId: accreditationOrgId || undefined,
        courseTypeId: courseTypeId || undefined,
        capacity: parseInt(capacity, 10) || undefined,
        confirmedStudents: parseInt(confirmedStudents, 10) || 0,
        startDate: startDate || undefined,
      });
      toast.success(`Course "${name.trim()}" created`);
      setName(''); setCourseTypeId(''); setStudents('0'); setStart('');
      onCreated();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-700">New course</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs text-neutral-500">Course name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ALS2 — Sydney (June)" className={field} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Accreditation</label>
          <select value={accreditationOrgId} onChange={(e) => setAccredId(e.target.value)} className={field}>
            <option value="">—</option>
            {accreditation.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Course type</label>
          <select value={courseTypeId} onChange={(e) => setCourseTypeId(e.target.value)} className={field} disabled={!accreditationOrgId}>
            <option value="">—</option>
            {courseTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Confirmed students</label>
          <input type="number" min="0" value={confirmedStudents} onChange={(e) => setStudents(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Capacity</label>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} className={field} />
        </div>
      </div>
      <button onClick={submit} disabled={busy}
        className="mt-4 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
        {busy ? 'Creating…' : 'Create course'}
      </button>
    </div>
  );
}

function CoursesContent() {
  const [courses, setCourses] = useState(null);
  const [accreditation, setAccreditation] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const r = await coursesApi.list();
    setCourses(r.courses);
  }, []);

  useEffect(() => {
    load();
    accreditationApi.list().then((r) => setAccreditation(r.accreditation)).catch(() => {});
  }, [load]);

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Plan and staff accredited courses. CTOP checks compliance as you go."
        action={
          <button onClick={() => setShowCreate((v) => !v)} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
            {showCreate ? 'Close' : 'New course'}
          </button>
        }
      />

      {showCreate && (
        <div className="mt-4">
          <CreateCourse accreditation={accreditation} onCreated={() => { setShowCreate(false); load(); }} />
        </div>
      )}

      <div className="mt-5">
        {courses === null ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : courses.length === 0 ? (
          <EmptyState
            icon="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5"
            title="No courses yet"
            message="Create your first course to start staffing and compliance checks."
            action={<button onClick={() => setShowCreate(true)} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">New course</button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-teal-300">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] || ''}`}>{statusLabel(c.status)}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{c.courseTypeName || '—'} · {c.confirmedStudents} students</p>
              </Link>
            ))}
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
