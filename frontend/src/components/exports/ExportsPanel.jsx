'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportsApi } from '@/services/data';
import { toast } from '@/stores/toastStore';

const TYPE_LABEL = {
  full_course: 'Scores',
  raw_data: 'Flight recorder',
  candidate_reports: 'Candidate reports',
};

export default function ExportsPanel({ cohortId }) {
  const [exports, setExports] = useState([]);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const [ex, au] = await Promise.all([exportsApi.list(cohortId), exportsApi.audit(cohortId)]);
    setExports(ex.exports);
    setAudit(au.audit);
  }, [cohortId]);

  useEffect(() => { load(); }, [load]);

  async function download(kind) {
    setBusy(kind);
    try {
      if (kind === 'scores') await exportsApi.downloadScores(cohortId);
      else await exportsApi.downloadFlightRecorder(cohortId);
      toast.success('Export downloaded');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium text-neutral-700">Exports</p>
        <p className="mt-0.5 text-xs text-neutral-400">Download cohort data as CSV (opens in Excel).</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => download('scores')} disabled={busy === 'scores'}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {busy === 'scores' ? 'Preparing…' : 'Scores CSV'}
          </button>
          <button onClick={() => download('fr')} disabled={busy === 'fr'}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">
            {busy === 'fr' ? 'Preparing…' : 'Flight recorder CSV'}
          </button>
        </div>
        <ul className="mt-4 divide-y divide-neutral-100">
          {exports.length === 0 ? (
            <li className="py-1.5 text-xs text-neutral-400">No exports yet.</li>
          ) : exports.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-neutral-700">{TYPE_LABEL[e.type] || e.type} · {e.format.toUpperCase()}</span>
              <span className="text-neutral-400">{e.fileSize} · {new Date(e.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium text-neutral-700">Audit log</p>
        <p className="mt-0.5 text-xs text-neutral-400">Recent score state changes in this cohort.</p>
        <ul className="mt-3 space-y-1.5">
          {audit.length === 0 ? (
            <li className="text-xs text-neutral-400">No activity yet.</li>
          ) : audit.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
              <span className="font-medium text-neutral-700">{a.learnerName}</span>
              <span className="capitalize">{a.action}</span>
              <span className="text-neutral-300">·</span>
              <span>{a.actor}</span>
              <span className="text-neutral-300">·</span>
              <span>{new Date(a.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
