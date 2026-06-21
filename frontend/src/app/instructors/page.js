'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Card, CardHeader, Button, Badge, Field, Input, Select, Tabs, Avatar, Icon, Skeleton } from '@/components/ui/kit';
import { instructorsApi, STAFF_ROLES, roleLabel, fmtDate, AVAIL_META, IC_OUTCOME_META } from '@/services/data';
import { toast } from '@/stores/toastStore';

const EMPLOYMENT = ['employee', 'casual', 'sole_trader', 'company', 'medical_consultant'];

function CreateInstructor({ onCreated, onCancel }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', region: '', employmentType: 'casual', status: 'active' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit() {
    if (!f.firstName.trim() || !f.lastName.trim()) return toast.error('First and last name required');
    setBusy(true);
    try {
      await instructorsApi.create(f);
      toast.success(`${f.firstName} ${f.lastName} added`);
      onCreated();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Card className="animate-in">
      <CardHeader title="New instructor" subtitle="Crew records — credentials and availability drive staffing." icon="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 7a3 3 0 11-2 0" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name"><Input value={f.firstName} onChange={set('firstName')} /></Field>
        <Field label="Last name"><Input value={f.lastName} onChange={set('lastName')} /></Field>
        <Field label="Email" hint="Used for invitations"><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Region"><Input value={f.region} onChange={set('region')} placeholder="e.g. Sydney" /></Field>
        <Field label="Employment">
          <Select value={f.employmentType} onChange={set('employmentType')}>
            {EMPLOYMENT.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={set('status')}>
            {['active', 'candidate', 'inactive'].map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add instructor'}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function CredentialsTab({ detail, reload }) {
  const [roles, setRoles] = useState([]);
  const [expiresAt, setExpiresAt] = useState('');
  const toggle = (r) => setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));

  async function add() {
    if (roles.length === 0) return toast.error('Pick at least one role');
    try { await instructorsApi.addCredential(detail.id, { eligibleRoles: roles, expiresAt: expiresAt || undefined }); setRoles([]); setExpiresAt(''); reload(); toast.success('Credential added'); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4 pt-4">
      {detail.credentials.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">No credentials yet.</p>
      ) : (
        <div className="space-y-2">
          {detail.credentials.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] p-3">
              <div className="flex flex-wrap gap-1.5">
                {c.eligibleRoles.map((r) => <Badge key={r} tone="teal">{roleLabel(r)}</Badge>)}
              </div>
              <span className="ml-auto text-xs text-[var(--ink-3)]">
                {c.expiresAt ? `Expires ${fmtDate(c.expiresAt)}` : 'No expiry'}
              </span>
              {c.expired && <Badge tone="rose" dot>Expired</Badge>}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-[var(--surface-2)] p-4">
        <p className="lbl">Add credential</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {STAFF_ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5 text-sm text-[var(--ink-2)]">
              <input type="checkbox" checked={roles.includes(r.value)} onChange={() => toggle(r.value)} className="accent-teal-700" /> {r.label}
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Expiry (optional)"><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field>
          <Button onClick={add}>Add</Button>
        </div>
      </div>
    </div>
  );
}

function AvailabilityTab({ detail, reload }) {
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('available');

  async function add() {
    if (!date) return toast.error('Pick a date');
    try { await instructorsApi.setAvailability(detail.id, { date, status }); setDate(''); reload(); }
    catch (e) { toast.error(e.message); }
  }
  async function remove(d) {
    try { await instructorsApi.removeAvailability(detail.id, d.slice(0, 10)); reload(); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4 pt-4">
      {detail.availability.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">No availability set. Add dates this instructor can work.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {detail.availability.map((a) => {
            const meta = AVAIL_META[a.status] || AVAIL_META.unknown;
            return (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] py-1 pl-2.5 pr-1 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${a.status === 'available' ? 'bg-teal-500' : a.status === 'unavailable' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                {fmtDate(a.date)}
                <span className="text-[var(--ink-3)]">{meta.label}</span>
                <button onClick={() => remove(a.date)} className="rounded p-0.5 text-[var(--ink-3)] hover:text-rose-600"><Icon d="M18 6L6 18M6 6l12 12" className="h-3.5 w-3.5" /></button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-xl bg-[var(--surface-2)] p-4">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="available">Available</option>
            <option value="tentative">Tentative</option>
            <option value="unavailable">Unavailable</option>
          </Select>
        </Field>
        <Button onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function IcTab({ detail, instructors, reload }) {
  const [stage, setStage] = useState('IC1');
  const [outcome, setOutcome] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [notes, setNotes] = useState('');

  async function add() {
    try {
      await instructorsApi.addIcProgress(detail.id, { stage, outcome: outcome || undefined, mentorId: mentorId || undefined, notes: notes || undefined });
      setOutcome(''); setNotes(''); reload();
      toast.success(outcome === 'passed' && stage === 'IC2' ? 'IC2 passed — promoted to active instructor' : 'IC progress recorded');
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4 pt-4">
      {detail.icProgress.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">No IC records. Log IC1/IC2 sign-offs as the candidate progresses.</p>
      ) : (
        <div className="space-y-2">
          {detail.icProgress.map((ic) => {
            const meta = ic.outcome ? IC_OUTCOME_META[ic.outcome] : null;
            return (
              <div key={ic.id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex items-center gap-2">
                  <Badge tone="blue">{ic.stage}</Badge>
                  {meta ? <Badge tone={meta.tone} dot>{meta.label}</Badge> : <Badge tone="neutral">In progress</Badge>}
                  <span className="ml-auto text-xs text-[var(--ink-3)]">{fmtDate(ic.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--ink-2)]">
                  {ic.courseName ? `Course: ${ic.courseName}` : 'No course'}{ic.mentorName ? ` · Mentor: ${ic.mentorName}` : ''}
                </p>
                {ic.notes && <p className="mt-1 text-xs text-[var(--ink-3)]">{ic.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
      <div className="rounded-xl bg-[var(--surface-2)] p-4">
        <p className="lbl">Record IC progress</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Stage"><Select value={stage} onChange={(e) => setStage(e.target.value)}><option>IC1</option><option>IC2</option></Select></Field>
          <Field label="Outcome">
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">In progress</option>
              {Object.entries(IC_OUTCOME_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Mentor">
            <Select value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
              <option value="">—</option>
              {instructors.filter((i) => i.id !== detail.id && i.status === 'active').map((i) => <option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>)}
            </Select>
          </Field>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sign-off note" /></Field>
        </div>
        <Button className="mt-3" onClick={add}>Record</Button>
      </div>
    </div>
  );
}

function InstructorDetail({ id, instructors, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('credentials');
  const reload = useCallback(() => instructorsApi.get(id).then((d) => { setDetail(d); onChanged?.(); }), [id, onChanged]);
  useEffect(() => { reload(); }, [reload]);

  if (!detail) return <div className="px-4 pb-4"><Skeleton className="h-24 w-full" /></div>;

  const tabs = [
    { value: 'credentials', label: 'Credentials', count: detail.credentials.length },
    { value: 'availability', label: 'Availability', count: detail.availability.length },
    { value: 'ic', label: 'IC pathway', count: detail.icProgress.length },
  ];

  return (
    <div className="border-t border-[var(--line)] bg-[var(--surface)] px-4 pb-4">
      <div className="pt-3"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
      {tab === 'credentials' && <CredentialsTab detail={detail} reload={reload} />}
      {tab === 'availability' && <AvailabilityTab detail={detail} reload={reload} />}
      {tab === 'ic' && <IcTab detail={detail} instructors={instructors} reload={reload} />}
    </div>
  );
}

const STATUS_TONE = { active: 'teal', candidate: 'amber', inactive: 'neutral' };

function InstructorsContent() {
  const [instructors, setInstructors] = useState(null);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const r = await instructorsApi.list(filter ? { status: filter } : {});
    setInstructors(r.instructors);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const FILTERS = [['', 'All'], ['active', 'Active'], ['candidate', 'Candidates'], ['inactive', 'Inactive']];

  return (
    <>
      <PageHeader
        title="Instructors"
        subtitle="Your crew — credentials, availability, and IC pathway."
        action={<Button onClick={() => setShowCreate((v) => !v)}><Icon d="M12 5v14M5 12h14" className="h-4 w-4" strokeWidth={2} /> New instructor</Button>}
      />

      {showCreate && <div className="mt-5"><CreateInstructor onCancel={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} /></div>}

      <div className="mt-5 flex gap-1.5">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${filter === v ? 'bg-[var(--accent)] text-white' : 'border border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-neutral-50'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {instructors === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : instructors.length === 0 ? (
          <EmptyState icon="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a8 8 0 0116 0" title="No instructors" message="Add instructors to build your staffing pool."
            action={<Button onClick={() => setShowCreate(true)}>New instructor</Button>} />
        ) : (
          <div className="space-y-2">
            {instructors.map((i) => (
              <div key={i.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-card">
                <div className="flex items-center gap-3 p-4">
                  <Avatar name={`${i.firstName} ${i.lastName}`} className="h-9 w-9 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--ink)]">{i.firstName} {i.lastName}</p>
                    <p className="mt-0.5 text-xs text-[var(--ink-3)]">{i.region || 'No region'} · {i.employmentType?.replace(/_/g, ' ') || '—'}</p>
                  </div>
                  <Badge tone={STATUS_TONE[i.status] || 'neutral'} dot>{i.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(open === i.id ? null : i.id)}>
                    {open === i.id ? 'Close' : 'Manage'} <Icon d={open === i.id ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} className="h-4 w-4" />
                  </Button>
                </div>
                {open === i.id && <InstructorDetail id={i.id} instructors={instructors} onChanged={load} />}
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
