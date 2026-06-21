'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { coursesApi, staffingApi, instructorsApi, STAFF_ROLES, roleLabel, STATUS_STYLE, statusLabel } from '@/services/data';
import { toast } from '@/stores/toastStore';

function ComplianceCard({ compliance }) {
  if (!compliance) return null;
  const ok = compliance.status === 'ready';
  return (
    <div className={`rounded-xl border p-5 ${ok ? 'border-teal-200 bg-teal-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-800">Compliance</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[compliance.status] || ''}`}>{statusLabel(compliance.status)}</span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-neutral-700">
        {compliance.explanation.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
        <span>Groups: {compliance.groups}</span>
        <span>Instructors: {compliance.assigned.instructors}/{compliance.required.instructors}</span>
        <span>Course director: {compliance.assigned.course_director}/{compliance.required.course_director}</span>
        <span>Medical lead: {compliance.assigned.medical_lead}/{compliance.required.medical_lead}</span>
        {compliance.required.doctor > 0 && <span>Doctor: {compliance.assigned.doctor}/{compliance.required.doctor}</span>}
      </div>
    </div>
  );
}

function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [staffing, setStaffing] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [instructors, setInstructors] = useState([]);
  const [pickInstr, setPickInstr] = useState('');
  const [pickRole, setPickRole] = useState('instructor');
  const [students, setStudents] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStaffing = useCallback(async () => {
    const r = await staffingApi.get(id);
    setStaffing(r.staffing);
    setCompliance(r.compliance);
  }, [id]);

  useEffect(() => {
    coursesApi.get(id).then((c) => { setCourse(c); setStudents(String(c.confirmedStudents ?? 0)); });
    loadStaffing();
    instructorsApi.list().then((r) => setInstructors(r.instructors)).catch(() => {});
  }, [id, loadStaffing]);

  async function assign() {
    if (!pickInstr) return toast.error('Pick an instructor');
    setBusy(true);
    try {
      const r = await staffingApi.assign(id, { instructorId: pickInstr, role: pickRole });
      setStaffing(r.staffing); setCompliance(r.compliance); setPickInstr('');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function remove(staffingId) {
    try {
      const r = await staffingApi.remove(id, staffingId);
      setStaffing(r.staffing); setCompliance(r.compliance);
    } catch (e) { toast.error(e.message); }
  }

  async function saveStudents() {
    const n = parseInt(students, 10);
    if (!Number.isInteger(n) || n < 0) return;
    try {
      const c = await coursesApi.update(id, { confirmedStudents: n });
      setCourse(c);
      await loadStaffing();
      toast.success('Student count updated');
    } catch (e) { toast.error(e.message); }
  }

  if (!course) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <>
      <Link href="/courses" className="text-sm text-teal-700 hover:underline">← Courses</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{course.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {course.courseTypeName || 'No course type'}{course.startDate ? ` · ${new Date(course.startDate).toLocaleDateString()}` : ''}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[course.status] || ''}`}>{statusLabel(course.status)}</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <ComplianceCard compliance={compliance} />

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-sm font-medium text-neutral-700">Confirmed students</p>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" min="0" value={students} onChange={(e) => setStudents(e.target.value)}
                className="w-28 rounded-md border border-neutral-300 px-3 py-1.5 text-sm" />
              <button onClick={saveStudents} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">Update</button>
              <span className="text-xs text-neutral-400">drives the staffing calculation</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-neutral-700">Staffing</p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1">
              <label className="text-xs text-neutral-500">Instructor</label>
              <select value={pickInstr} onChange={(e) => setPickInstr(e.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
                <option value="">Select…</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.firstName} {i.lastName}{i.status === 'candidate' ? ' (candidate)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Role</label>
              <select value={pickRole} onChange={(e) => setPickRole(e.target.value)} className="mt-1 block rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
                {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={assign} disabled={busy} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">Assign</button>
          </div>

          <ul className="mt-4 divide-y divide-neutral-100">
            {staffing.length === 0 ? (
              <li className="py-2 text-sm text-neutral-400">No staff assigned yet.</li>
            ) : staffing.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-neutral-800">{s.instructorName}</span>
                <span className="flex items-center gap-3">
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{roleLabel(s.role)}</span>
                  <button onClick={() => remove(s.id)} className="text-xs text-neutral-400 hover:text-rose-600">Remove</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default function CourseDetailPage() {
  return (
    <AppShell>
      <CourseDetail />
    </AppShell>
  );
}
