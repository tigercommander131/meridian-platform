'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { instructorsApi, STAFF_ROLES, roleLabel } from '@/services/data';
import { toast } from '@/stores/toastStore';

const field = 'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600';

function CreateInstructor({ onCreated }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', region: '', employmentType: 'casual', status: 'active' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit() {
    if (!f.firstName.trim() || !f.lastName.trim()) return toast.error('First and last name required');
    setBusy(true);
    try {
      await instructorsApi.create(f);
      toast.success(`Instructor ${f.firstName} ${f.lastName} added`);
      setF({ firstName: '', lastName: '', email: '', region: '', employmentType: 'casual', status: 'active' });
      onCreated();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-700">New instructor</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="text-xs text-neutral-500">First name</label><input value={f.firstName} onChange={set('firstName')} className={field} /></div>
        <div><label className="text-xs text-neutral-500">Last name</label><input value={f.lastName} onChange={set('lastName')} className={field} /></div>
        <div><label className="text-xs text-neutral-500">Email</label><input value={f.email} onChange={set('email')} className={field} /></div>
        <div><label className="text-xs text-neutral-500">Region</label><input value={f.region} onChange={set('region')} placeholder="e.g. Sydney" className={field} /></div>
        <div>
          <label className="text-xs text-neutral-500">Employment</label>
          <select value={f.employmentType} onChange={set('employmentType')} className={field}>
            {['employee', 'casual', 'sole_trader', 'company', 'medical_consultant'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Status</label>
          <select value={f.status} onChange={set('status')} className={field}>
            {['active', 'candidate', 'inactive'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <button onClick={submit} disabled={busy} className="mt-4 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
        {busy ? 'Adding…' : 'Add instructor'}
      </button>
    </div>
  );
}

function Credentials({ instructorId }) {
  const [detail, setDetail] = useState(null);
  const [roles, setRoles] = useState([]);

  const load = useCallback(() => instructorsApi.get(instructorId).then(setDetail), [instructorId]);
  useEffect(() => { load(); }, [load]);

  function toggle(role) {
    setRoles((s) => (s.includes(role) ? s.filter((r) => r !== role) : [...s, role]));
  }
  async function add() {
    if (roles.length === 0) return toast.error('Pick at least one role');
    try { await instructorsApi.addCredential(instructorId, { eligibleRoles: roles }); setRoles([]); load(); toast.success('Credential added'); }
    catch (e) { toast.error(e.message); }
  }

  if (!detail) return <p className="mt-2 text-xs text-neutral-400">Loading…</p>;
  const eligible = [...new Set((detail.credentials || []).flatMap((c) => c.eligibleRoles))];

  return (
    <div className="mt-2 rounded-md bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">Eligible roles: {eligible.length ? eligible.map(roleLabel).join(', ') : 'none yet'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {STAFF_ROLES.map((r) => (
          <label key={r.value} className="flex items-center gap-1 text-xs text-neutral-700">
            <input type="checkbox" checked={roles.includes(r.value)} onChange={() => toggle(r.value)} /> {r.label}
          </label>
        ))}
        <button onClick={add} className="rounded-md bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800">Add credential</button>
      </div>
    </div>
  );
}

function InstructorsContent() {
  const [instructors, setInstructors] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const r = await instructorsApi.list();
    setInstructors(r.instructors);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Instructors" subtitle="Your crew — credentials and eligible roles for staffing courses."
        action={<button onClick={() => setShowCreate((v) => !v)} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">{showCreate ? 'Close' : 'New instructor'}</button>} />

      {showCreate && <div className="mt-4"><CreateInstructor onCreated={() => { setShowCreate(false); load(); }} /></div>}

      <div className="mt-5">
        {instructors === null ? <p className="text-sm text-neutral-400">Loading…</p>
          : instructors.length === 0 ? (
            <EmptyState icon="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0" title="No instructors yet" message="Add instructors to build your staffing pool."
              action={<button onClick={() => setShowCreate(true)} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">New instructor</button>} />
          ) : (
            <div className="space-y-2">
              {instructors.map((i) => (
                <div key={i.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{i.firstName} {i.lastName}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{i.region || '—'} · {i.employmentType?.replace(/_/g, ' ') || '—'} · {i.status}</p>
                    </div>
                    <button onClick={() => setOpen(open === i.id ? null : i.id)} className="text-xs text-teal-700 hover:underline">
                      {open === i.id ? 'Hide' : 'Credentials'}
                    </button>
                  </div>
                  {open === i.id && <Credentials instructorId={i.id} />}
                </div>
              ))}
            </div>
          )}
      </div>
    </>
  );
}

export default function InstructorsPage() {
  return (
    <AppShell>
      <InstructorsContent />
    </AppShell>
  );
}
