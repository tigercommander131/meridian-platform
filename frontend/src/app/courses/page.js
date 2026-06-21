'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardHeader, Button, Field, Input, Select, Skeleton, Icon } from '@/components/ui/kit';
import { coursesApi, accreditationApi, fmtDate } from '@/services/data';
import { toast } from '@/stores/toastStore';

function CreateCourse({ accreditation, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [accreditationOrgId, setAccredId] = useState('');
  const [courseTypeId, setCourseTypeId] = useState('');
  const [courseTypes, setCourseTypes] = useState([]);
  const [confirmedStudents, setStudents] = useState('0');
  const [capacity, setCapacity] = useState('24');
  const [region, setRegion] = useState('');
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
        region: region.trim() || undefined,
        startDate: startDate || undefined,
      });
      toast.success(`Course "${name.trim()}" created`);
      onCreated();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Card className="animate-in">
      <CardHeader title="New course" subtitle="CTOP checks staffing compliance as you go." icon="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Course name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ALS2 — Sydney (June)" />
        </Field>
        <Field label="Accreditation">
          <Select value={accreditationOrgId} onChange={(e) => setAccredId(e.target.value)}>
            <option value="">—</option>
            {accreditation.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </Select>
        </Field>
        <Field label="Course type">
          <Select value={courseTypeId} onChange={(e) => setCourseTypeId(e.target.value)} disabled={!accreditationOrgId}>
            <option value="">—</option>
            {courseTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
          </Select>
        </Field>
        <Field label="Confirmed students"><Input type="number" min="0" value={confirmedStudents} onChange={(e) => setStudents(e.target.value)} /></Field>
        <Field label="Capacity"><Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
        <Field label="Region" hint="Drives staffing escalation"><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Sydney" /></Field>
        <Field label="Start date"><Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create course'}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function CourseCard({ c }) {
  const fill = c.capacity ? Math.min(100, Math.round((c.confirmedStudents / c.capacity) * 100)) : 0;
  return (
    <Link href={`/courses/${c.id}`}
      className="group rounded-2xl border border-[var(--line)] bg-white p-5 shadow-card transition-all hover:border-teal-300 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--ink)]">{c.name}</p>
        <StatusBadge status={c.status} className="shrink-0" />
      </div>
      <p className="mt-1 text-xs text-[var(--ink-3)]">{c.courseTypeName || 'No course type'}{c.startDate ? ` · ${fmtDate(c.startDate)}` : ''}</p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
          <span>{c.confirmedStudents}{c.capacity ? ` / ${c.capacity}` : ''} students</span>
          {c.capacity ? <span className="text-[var(--ink-3)]">{fill}% full</span> : null}
        </div>
        {c.capacity ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${fill}%` }} />
          </div>
        ) : null}
      </div>
    </Link>
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
        subtitle="Plan and staff accredited courses."
        action={<Button onClick={() => setShowCreate((v) => !v)}>
          <Icon d="M12 5v14M5 12h14" className="h-4 w-4" strokeWidth={2} /> New course
        </Button>}
      />

      {showCreate && <div className="mt-5"><CreateCourse accreditation={accreditation} onCancel={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} /></div>}

      <div className="mt-6">
        {courses === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM14 3v5h5"
            title="No courses yet"
            message="Create your first course to start staffing and compliance checks."
            action={<Button onClick={() => setShowCreate(true)}>New course</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {courses.map((c) => <CourseCard key={c.id} c={c} />)}
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
