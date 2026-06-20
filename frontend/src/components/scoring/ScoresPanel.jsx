'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { sessionsApi, scoringApi, SCORE_STATES } from '@/services/data';
import { toast } from '@/stores/toastStore';

function Badge({ state }) {
  const s = SCORE_STATES[state] || { label: state, cls: 'bg-neutral-100 text-neutral-600' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

// Which actions are offered for each state.
const ACTIONS = {
  pending_approval: ['approve'],
  approved: ['release', 'dispute'],
  released: ['dispute'],
  disputed: ['approve', 'reopen'],
};

function AuditTrail({ scoreId }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => { scoringApi.detail(scoreId).then(setDetail).catch(() => {}); }, [scoreId]);
  if (!detail) return <p className="px-4 py-3 text-xs text-neutral-400">Loading history…</p>;
  return (
    <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
      {detail.disputeReason && (
        <p className="mb-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">Dispute: {detail.disputeReason}</p>
      )}
      <ol className="space-y-1.5">
        {detail.audit.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            <span className="font-medium text-neutral-700 capitalize">{a.action}</span>
            <span>by {a.actor}</span>
            <span className="text-neutral-300">·</span>
            <span>{new Date(a.at).toLocaleString()}</span>
            {a.note && <span className="italic text-neutral-400">— {a.note}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ScoresPanel({ sessionId }) {
  const [scores, setScores] = useState([]);
  const [open, setOpen] = useState(null); // scoreId whose trail is expanded
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const res = await sessionsApi.scores(sessionId);
    setScores(res.scores);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function act(scoreId, action) {
    setBusy(scoreId + action);
    try {
      if (action === 'dispute') {
        const reason = window.prompt('Reason for dispute?');
        if (!reason) { setBusy(null); return; }
        await scoringApi.dispute(scoreId, reason);
      } else {
        await scoringApi[action](scoreId);
      }
      toast.success(`Score ${action === 'reopen' ? 'reopened' : action + 'd'}`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (scores.length === 0) {
    return <p className="text-sm text-neutral-400">No scores submitted yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">Learner</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Total</th>
            <th className="px-4 py-2 font-medium">State</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s) => (
            <Fragment key={s.id}>
              <tr className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-800">{s.learnerName}</td>
                <td className="px-4 py-2 text-neutral-500">{s.role ? s.role.replace('_', ' ') : '—'}</td>
                <td className="px-4 py-2 font-medium text-neutral-800">{s.totalScore}</td>
                <td className="px-4 py-2"><Badge state={s.state} /></td>
                <td className="px-4 py-2 text-right">
                  {(ACTIONS[s.state] || []).map((action) => (
                    <button
                      key={action}
                      onClick={() => act(s.id, action)}
                      disabled={busy === s.id + action}
                      className={`ml-2 rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                        action === 'approve' || action === 'release'
                          ? 'bg-teal-700 text-white hover:bg-teal-800'
                          : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {action === 'reopen' ? 'Reopen' : action[0].toUpperCase() + action.slice(1)}
                    </button>
                  ))}
                  <button
                    onClick={() => setOpen(open === s.id ? null : s.id)}
                    className="ml-2 text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    {open === s.id ? 'Hide' : 'History'}
                  </button>
                </td>
              </tr>
              {open === s.id && (
                <tr>
                  <td colSpan={5} className="p-0"><AuditTrail scoreId={s.id} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
