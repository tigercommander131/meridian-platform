'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import ComplianceMeter from '@/components/ui/ComplianceMeter';
import { Card, CardHeader, Button, Badge, Field, Input, Select, Avatar, Icon, Spinner } from '@/components/ui/kit';
import { FlightStatus, Station, Lamp, Stamp } from '@/components/ui/aviation';
import {
  coursesApi, staffingApi, STAFF_ROLES, roleLabel, fmtDate, station,
  TIER_META, AVAIL_META, INVITE_META,
} from '@/services/data';
import { toast } from '@/stores/toastStore';

function Clearance({ compliance }) {
  if (!compliance) return null;
  const ok = compliance.status === 'ready';
  return (
    <Card className={ok ? 'border-[color:var(--accent)]/30' : compliance.status === 'compliance_risk' ? 'border-rose-200' : ''}>
      <div className="flex items-center justify-between">
        <p className="lbl">Clearance</p>
        <FlightStatus status={compliance.status} />
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-4 py-3">
        {ok ? <Stamp tone="go">Cleared</Stamp> : <Stamp tone={compliance.status === 'compliance_risk' ? 'stop' : 'warn'}>Hold</Stamp>}
        <p className="text-xs text-[var(--ink-2)]">
          {ok ? 'Fully crewed & compliant — cleared for departure.' : `${compliance.groups} group${compliance.groups === 1 ? '' : 's'} · crew shortfall blocks clearance.`}
        </p>
      </div>

      <div className="mt-4"><ComplianceMeter compliance={compliance} /></div>

      <ul className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-3">
        {compliance.explanation.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[var(--ink-2)]">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--ink-3)]" />{line}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CandidateRow({ c, busy, onAssign }) {
  const tier = TIER_META[c.tier] || TIER_META.regional;
  const avail = AVAIL_META[c.availability] || AVAIL_META.unknown;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
      <Avatar name={c.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--ink)]">{c.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-3)]">
          {c.region || 'No base'}{!c.eligible && <span className="text-amber-600">· not credentialed</span>}
        </p>
      </div>
      <Badge tone={avail.tone}>{avail.label}</Badge>
      <Badge tone={tier.tone} title={tier.hint}>{tier.label}</Badge>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAssign(c, false)}>Assign</Button>
      <Button size="sm" disabled={busy || !c.email} title={c.email ? '' : 'No email on file'} onClick={() => onAssign(c, true)}>Assign + invite</Button>
    </div>
  );
}

function StandbyList({ courseId, onChanged }) {
  const [role, setRole] = useState('instructor');
  const [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (r) => {
    setCandidates(null);
    try { setCandidates((await staffingApi.candidates(courseId, r)).candidates); }
    catch (e) { toast.error(e.message); setCandidates([]); }
  }, [courseId]);
  useEffect(() => { load(role); }, [role, load]);

  async function assign(c, withInvite) {
    setBusy(true);
    try {
      const r = await staffingApi.assign(courseId, { instructorId: c.instructorId, role });
      const created = r.staffing.find((s) => s.instructorId === c.instructorId && s.role === role);
      if (withInvite && created) {
        const inv = await staffingApi.invite(courseId, created.id, { escalationTier: c.tier });
        toast.success(inv.noEmail ? 'Assigned — no email, share link manually' : inv.emailSkipped ? 'Assigned — invite logged (email off)' : 'Assigned & invited');
      } else { toast.success(`${c.name} assigned as ${roleLabel(role)}`); }
      onChanged(r); load(role);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-4">
      <div className="flex items-end justify-between gap-2">
        <Field label="Role to fill" className="flex-1"><Select value={role} onChange={(e) => setRole(e.target.value)}>{STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field>
      </div>
      <p className="mt-3 text-xs text-[var(--ink-3)]">
        Standby list — ranked <span className="text-[var(--accent-ink)]">local</span> → <span className="text-sky-700">regional</span> → <span className="text-amber-700">emergency</span>. Unavailable crew hidden.
      </p>
      <div className="mt-2 space-y-2">
        {candidates === null ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--ink-3)]"><Spinner className="h-4 w-4 text-[var(--accent)]" /> Finding eligible crew…</div>
        ) : candidates.length === 0 ? (
          <p className="py-4 text-sm text-[var(--ink-3)]">No eligible, available crew. Add credentials/availability or widen the role.</p>
        ) : candidates.map((c) => <CandidateRow key={c.instructorId} c={c} busy={busy} onAssign={assign} />)}
      </div>
    </div>
  );
}

function ManifestRow({ s, courseId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const invite = INVITE_META[s.invitationStatus] || INVITE_META.invited;
  const tier = s.escalationTier ? TIER_META[s.escalationTier] : null;

  async function sendInvite() {
    setBusy(true);
    try {
      const inv = await staffingApi.invite(courseId, s.id, {});
      toast.success(inv.noEmail ? 'No email on file — copy the link' : inv.emailSkipped ? 'Invite logged (email off)' : s.invited ? 'Reminder sent' : 'Invitation sent');
      onChanged(await staffingApi.get(courseId));
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  function copyLink() { navigator.clipboard?.writeText(`${window.location.origin}/invite/${s.inviteToken}`); toast.success('Invite link copied'); }
  async function remove() { try { onChanged(await staffingApi.remove(courseId, s.id)); } catch (e) { toast.error(e.message); } }

  return (
    <div className="flex flex-wrap items-center gap-2.5 py-3">
      <Avatar name={s.instructorName} className="h-8 w-8 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--ink)]">{s.instructorName}</p>
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--ink-3)]">{roleLabel(s.role)}{s.reminderCount > 0 ? ` · ${s.reminderCount} reminder${s.reminderCount === 1 ? '' : 's'}` : ''}</p>
      </div>
      {tier && <Badge tone={tier.tone}>{tier.label}</Badge>}
      {s.invited && <Badge tone={invite.tone} dot>{invite.label}</Badge>}
      {s.invited && s.invitationStatus !== 'declined' && (
        <Button size="sm" variant="ghost" onClick={copyLink} title="Copy invite link"><Icon d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" className="h-4 w-4" /></Button>
      )}
      <Button size="sm" variant="secondary" disabled={busy} onClick={sendInvite}>{s.invited ? 'Resend' : 'Invite'}</Button>
      <Button size="sm" variant="ghost" onClick={remove} className="text-[var(--ink-3)] hover:text-rose-600"><Icon d="M18 6L6 18M6 6l12 12" className="h-4 w-4" /></Button>
    </div>
  );
}

function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [staffing, setStaffing] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [students, setStudents] = useState('');
  const [adding, setAdding] = useState(false);

  const applyStaffing = useCallback((r) => { setStaffing(r.staffing); setCompliance(r.compliance); }, []);
  const loadStaffing = useCallback(async () => { applyStaffing(await staffingApi.get(id)); }, [id, applyStaffing]);

  useEffect(() => {
    coursesApi.get(id).then((c) => { setCourse(c); setStudents(String(c.confirmedStudents ?? 0)); });
    loadStaffing();
  }, [id, loadStaffing]);

  async function saveStudents() {
    const n = parseInt(students, 10);
    if (!Number.isInteger(n) || n < 0) return;
    try { const c = await coursesApi.update(id, { confirmedStudents: n }); setCourse(c); await loadStaffing(); toast.success('Student count updated'); }
    catch (e) { toast.error(e.message); }
  }

  if (!course) return <div className="flex items-center gap-2 text-sm text-[var(--ink-3)]"><Spinner className="h-4 w-4 text-[var(--accent)]" /> Loading…</div>;
  const declined = staffing.filter((s) => s.invitationStatus === 'declined');

  return (
    <>
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-[var(--accent-ink)] hover:underline">
        <Icon d="M15 18l-6-6 6-6" className="h-4 w-4" /> Courses
      </Link>

      {/* Flight banner */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--board-line)] bg-board board-grid">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-5">
            <Station code={station(course.region)} sub={course.region || 'Base TBD'} onBoard />
            <Icon d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L11 19v-5.5z" className="h-5 w-5 text-[var(--accent)]" strokeWidth={0} />
            <div>
              <p className="font-mono text-xs tracking-widest text-board-ink/50">{course.courseTypeName || 'COURSE'}</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-board-ink">{course.name}</h1>
              <p className="mt-1 font-mono text-xs text-board-ink/60">{fmtDate(course.startDate, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}{course.capacity ? ` · ${course.confirmedStudents}/${course.capacity} PAX` : ''}</p>
            </div>
          </div>
          <FlightStatus status={course.status} onBoard className="text-sm" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-5">
          <Clearance compliance={compliance} />
          <Card>
            <CardHeader title="Confirmed students" subtitle="Drives the crew calculation" />
            <div className="flex items-center gap-2">
              <Input type="number" min="0" value={students} onChange={(e) => setStudents(e.target.value)} className="w-28" />
              <Button variant="secondary" onClick={saveStudents}>Update</Button>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Crew manifest" subtitle="Assign crew, send invitations, track responses."
            action={<Button size="sm" onClick={() => setAdding((v) => !v)}>{adding ? 'Done' : 'Add crew'}</Button>} />

          {adding && <div className="mb-4"><StandbyList courseId={id} onChanged={applyStaffing} /></div>}

          {staffing.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--ink-3)]">No crew assigned. Use “Add crew” to staff this course.</p>
          ) : (
            <div className="divide-y divide-[var(--line)]">{staffing.map((s) => <ManifestRow key={s.id} s={s} courseId={id} onChanged={applyStaffing} />)}</div>
          )}

          {declined.length > 0 && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {declined.length} declined — these don’t count toward clearance. Invite replacements from the standby list.
            </p>
          )}
        </Card>
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
