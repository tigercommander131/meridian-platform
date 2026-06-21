'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LogoMark } from '@/components/brand/Logo';
import { Button, Textarea, Spinner } from '@/components/ui/kit';
import { Station, FlightPath, Stamp } from '@/components/ui/aviation';
import { invitationsApi, fmtDate, station } from '@/services/data';

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-grid" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">{children}</div>
    </main>
  );
}

function Pass({ inv, children }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-pop">
      {/* Header strip */}
      <div className="flex items-center justify-between bg-board board-grid px-6 py-4">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <div className="leading-tight">
            <p className="font-mono text-[11px] font-bold tracking-widest text-board-ink">CTOP · BOARDING PASS</p>
            <p className="text-[10px] text-board-ink/50">Crew staffing invitation</p>
          </div>
        </div>
        <p className="font-mono text-sm font-bold tracking-wider text-[var(--accent)]">{inv.roleLabel?.toUpperCase().slice(0, 12)}</p>
      </div>

      {/* Main */}
      <div className="px-6 pb-6 pt-5">
        <p className="lbl">Crew member</p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">{inv.instructorName}</p>

        <div className="mt-5 flex items-center justify-between gap-4">
          <Station code={station(inv.courseType || 'CRS')} sub={inv.courseType || 'Course'} />
          <FlightPath className="flex-1" />
          <Station code="GATE" sub={inv.role === 'course_director' ? 'Lead' : 'Crew'} className="text-right" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-[var(--line-2)] pt-4 font-mono text-sm">
          <div><p className="lbl">Role</p><p className="mt-1 text-[var(--ink)]">{inv.roleLabel}</p></div>
          <div><p className="lbl">Date</p><p className="mt-1 text-[var(--ink)]">{fmtDate(inv.startDate, { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
          <div><p className="lbl">Course</p><p className="mt-1 truncate text-[var(--ink)]">{inv.courseName}</p></div>
        </div>
      </div>

      {/* Perforation + stub */}
      <div className="ticket-notch border-t border-dashed border-[var(--line-2)]" />
      <div className="bg-[var(--surface-2)] px-6 py-5">{children}</div>
    </div>
  );
}

function InviteContent() {
  const { token } = useParams();
  const search = useSearchParams();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [showDecline, setShowDecline] = useState(false);

  const load = useCallback(() => { invitationsApi.get(token).then(setInv).catch((e) => setError(e.message)); }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (search.get('r') === 'decline') setShowDecline(true); }, [search]);

  const respond = useCallback(async (response) => {
    setBusy(true);
    try { await invitationsApi.respond(token, { response, reason: response === 'decline' ? reason : undefined }); setDone(response); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [token, reason]);

  if (error) return <Shell><div className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center shadow-soft"><p className="text-sm font-medium text-[var(--ink)]">Invitation unavailable</p><p className="mt-1 text-sm text-[var(--ink-3)]">{error}</p></div></Shell>;
  if (!inv) return <Shell><div className="flex items-center justify-center gap-2 rounded-3xl border border-[var(--line)] bg-white p-10 text-sm text-[var(--ink-3)] shadow-soft"><Spinner className="h-4 w-4 text-[var(--accent)]" /> Loading invitation…</div></Shell>;

  const already = ['accepted', 'declined'].includes(inv.status) && !done;
  const finalState = done || (already ? (inv.status === 'accepted' ? 'accept' : 'decline') : null);

  return (
    <Shell>
      <Pass inv={inv}>
        {finalState ? (
          <div className="flex flex-col items-center py-2 text-center">
            <Stamp tone={finalState === 'accept' ? 'go' : 'stop'}>{finalState === 'accept' ? 'Cleared' : 'Declined'}</Stamp>
            <p className="mt-4 text-sm text-[var(--ink-2)]">
              {finalState === 'accept' ? `You're confirmed as ${inv.roleLabel} for ${inv.courseName}.` : `You've declined ${inv.courseName}. The coordinator has been notified.`}
            </p>
            <p className="mt-2 text-xs text-[var(--ink-3)]">You can close this page.</p>
          </div>
        ) : !showDecline ? (
          <>
            <p className="text-sm text-[var(--ink-2)]">Hi {inv.instructorName.split(' ')[0]} — can you crew this course?</p>
            {inv.message && <p className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-sm text-[var(--ink-2)]">“{inv.message}”</p>}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => respond('accept')}>{busy ? 'Saving…' : 'Accept'}</Button>
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setShowDecline(true)}>Decline</Button>
            </div>
          </>
        ) : (
          <>
            <p className="lbl">Reason (optional)</p>
            <Textarea className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Let the coordinator know why…" />
            <div className="mt-3 flex gap-2">
              <Button variant="danger" className="flex-1" disabled={busy} onClick={() => respond('decline')}>{busy ? 'Saving…' : 'Confirm decline'}</Button>
              <Button variant="ghost" onClick={() => setShowDecline(false)}>Back</Button>
            </div>
          </>
        )}
      </Pass>
      <p className="mt-5 text-center text-xs text-[var(--ink-3)]">CTOP · Clinical Training Operations Platform</p>
    </Shell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<Shell><div className="py-10 text-center text-sm text-[var(--ink-3)]">Loading…</div></Shell>}>
      <InviteContent />
    </Suspense>
  );
}
