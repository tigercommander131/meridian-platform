'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LogoMark } from '@/components/brand/Logo';
import { Button, Textarea, Spinner, Icon } from '@/components/ui/kit';
import { invitationsApi, fmtDate, INVITE_META } from '@/services/data';

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-grid" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-[var(--ink)]">CTOP</p>
            <p className="text-[11px] text-[var(--ink-3)]">Clinical Training Operations</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-7 shadow-soft">{children}</div>
      </div>
    </main>
  );
}

function Fact({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2.5 text-sm last:border-0">
      <span className="text-[var(--ink-3)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{value}</span>
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

  const load = useCallback(() => {
    invitationsApi.get(token).then(setInv).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // Pre-select decline form if linked with ?r=decline.
  useEffect(() => { if (search.get('r') === 'decline') setShowDecline(true); }, [search]);

  const respond = useCallback(async (response) => {
    setBusy(true);
    try {
      await invitationsApi.respond(token, { response, reason: response === 'decline' ? reason : undefined });
      setDone(response);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [token, reason]);

  if (error) return <Shell><div className="text-center"><p className="text-sm font-medium text-[var(--ink)]">Invitation unavailable</p><p className="mt-1 text-sm text-[var(--ink-3)]">{error}</p></div></Shell>;
  if (!inv) return <Shell><div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--ink-3)]"><Spinner className="h-4 w-4 text-teal-700" /> Loading invitation…</div></Shell>;

  const already = ['accepted', 'declined'].includes(inv.status) && !done;
  const finalState = done || (already ? inv.status === 'accepted' ? 'accept' : 'decline' : null);

  if (finalState) {
    const accepted = finalState === 'accept';
    return (
      <Shell>
        <div className="text-center">
          <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${accepted ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-600'}`}>
            <Icon d={accepted ? 'M5 13l4 4L19 7' : 'M18 6L6 18M6 6l12 12'} className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-lg font-semibold text-[var(--ink)]">{accepted ? 'Thanks — you’re in' : 'Response recorded'}</p>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            {accepted ? `You’ve accepted ${inv.roleLabel} for ${inv.courseName}.` : `You’ve declined ${inv.courseName}. The coordinator has been notified.`}
          </p>
          <p className="mt-4 text-xs text-[var(--ink-3)]">You can close this page.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Staffing invitation</p>
      <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--ink)]">{inv.courseName}</h1>
      <p className="mt-1 text-sm text-[var(--ink-2)]">Hi {inv.instructorName}, you’re invited to join the crew.</p>

      <div className="mt-5">
        <Fact label="Role" value={inv.roleLabel} />
        {inv.courseType && <Fact label="Course" value={inv.courseType} />}
        <Fact label="Date" value={fmtDate(inv.startDate, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} />
      </div>

      {inv.message && <p className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-sm text-[var(--ink-2)]">“{inv.message}”</p>}

      {!showDecline ? (
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => respond('accept')}>{busy ? 'Saving…' : 'Accept'}</Button>
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setShowDecline(true)}>Decline</Button>
        </div>
      ) : (
        <div className="mt-6">
          <p className="lbl">Reason (optional)</p>
          <Textarea className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Let the coordinator know why…" />
          <div className="mt-3 flex gap-2">
            <Button variant="danger" className="flex-1" disabled={busy} onClick={() => respond('decline')}>{busy ? 'Saving…' : 'Confirm decline'}</Button>
            <Button variant="ghost" onClick={() => setShowDecline(false)}>Back</Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<Shell><div className="py-6 text-center text-sm text-[var(--ink-3)]">Loading…</div></Shell>}>
      <InviteContent />
    </Suspense>
  );
}
