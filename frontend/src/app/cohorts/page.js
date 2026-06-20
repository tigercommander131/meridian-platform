'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { coursesApi, cohortsApi, learnersApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

function CreateCohort({ courseId, learners, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function submit() {
    if (!name) return toast.error('Cohort name required');
    setBusy(true);
    try {
      await cohortsApi.create(courseId, { name, learnerIds: [...selected] });
      toast.success(`Cohort "${name}" created with ${selected.size} learner(s)`);
      setName('');
      setSelected(new Set());
      onCreated();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-700">New cohort</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Cohort name (e.g. June 2026 — Batch A)"
        className="mt-3 w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
      />
      <p className="mt-4 text-xs text-neutral-500">Select learners ({selected.size} chosen)</p>
      <div className="mt-2 max-h-48 overflow-auto rounded-md border border-neutral-200">
        {learners.map((l) => (
          <label key={l.id} className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-1.5 text-sm last:border-0 hover:bg-neutral-50">
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
            <span className="text-neutral-700">{l.firstName} {l.lastName}</span>
            <span className="text-xs text-neutral-400">{l.email}</span>
          </label>
        ))}
      </div>
      <button onClick={submit} disabled={busy}
        className="mt-3 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
        {busy ? 'Creating…' : 'Create cohort'}
      </button>
    </div>
  );
}

function CohortsContent() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [learners, setLearners] = useState([]);
  const [cohorts, setCohorts] = useState([]);

  useEffect(() => {
    (async () => {
      const [c, l] = await Promise.all([coursesApi.list(), learnersApi.list({ limit: 200 })]);
      setCourses(c.courses);
      setLearners(l.learners);
      if (c.courses[0]) setCourseId(c.courses[0].id);
    })();
  }, []);

  const loadCohorts = useCallback(async (cid) => {
    if (!cid) return;
    const res = await cohortsApi.listForCourse(cid);
    setCohorts(res.cohorts);
  }, []);

  useEffect(() => { loadCohorts(courseId); }, [courseId, loadCohorts]);

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900">Cohorts</h1>
      <p className="mt-1 text-sm text-neutral-500">Group learners and generate a check-in QR code.</p>

      <div className="mt-4">
        <label className="text-xs text-neutral-500">Course</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {courseId && <CreateCohort courseId={courseId} learners={learners} onCreated={() => loadCohorts(courseId)} />}

        <div>
          <p className="text-sm font-medium text-neutral-700">Existing cohorts</p>
          <div className="mt-2 space-y-2">
            {cohorts.length === 0 ? (
              <p className="text-sm text-neutral-400">None yet for this course.</p>
            ) : (
              cohorts.map((c) => (
                <Link key={c.id} href={`/cohorts/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-teal-300">
                  <span className="text-sm font-medium text-neutral-800">{c.name}</span>
                  <span className="text-xs text-neutral-500">{c.learnerCount} learner(s) →</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function CohortsPage() {
  return (
    <AppShell>
      <CohortsContent />
    </AppShell>
  );
}
