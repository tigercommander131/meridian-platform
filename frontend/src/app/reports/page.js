'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { learnersApi, reportsApi, certificatesApi } from '@/services/data';
import { downloadReportPdf } from '@/utils/reportPdf';
import { toast } from '@/stores/toastStore';

function PercentBar({ percent }) {
  return (
    <div className="h-2 w-32 overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function ReportsContent() {
  const [learners, setLearners] = useState([]);
  const [learnerId, setLearnerId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);

  async function issueCert() {
    setIssuing(true);
    try {
      await certificatesApi.issue(report.learner.id, {});
      toast.success(`Certificate issued to ${report.learner.name} — they can download it in their portal`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIssuing(false);
    }
  }

  useEffect(() => {
    learnersApi.list({ limit: 200 }).then((res) => {
      setLearners(res.learners || []);
    });
  }, []);

  useEffect(() => {
    if (!learnerId) { setReport(null); return; }
    setLoading(true);
    reportsApi.forLearner(learnerId)
      .then(setReport)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [learnerId]);

  return (
    <>
      <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
      <p className="mt-1 text-sm text-neutral-500">Released assessment results per candidate. Export to PDF.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-500">Candidate</label>
          <select value={learnerId} onChange={(e) => setLearnerId(e.target.value)}
            className="mt-1 block w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Select a candidate…</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
            ))}
          </select>
        </div>
        {report && report.results.length > 0 && (
          <button onClick={() => downloadReportPdf(report)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Download PDF
          </button>
        )}
        {report && (
          <button onClick={issueCert} disabled={issuing}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {issuing ? 'Issuing…' : 'Issue certificate'}
          </button>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-neutral-500">Loading report…</p>}

      {report && !loading && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between rounded-lg border border-neutral-200 bg-white px-5 py-4">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{report.learner.name}</p>
              <p className="text-sm text-neutral-500">{report.learner.email}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-teal-700">{report.summary.averagePercent}%</p>
              <p className="text-xs text-neutral-400">{report.summary.assessed} released · avg</p>
            </div>
          </div>

          {report.results.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-400">No released assessments for this candidate yet. Approve and release scores from a session.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {report.results.map((r) => (
                <div key={r.scoreId} className="rounded-lg border border-neutral-200 bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {r.scenarioName}{r.role ? ` · ${r.role.replace('_', ' ')}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">{r.rubricName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <PercentBar percent={r.percent} />
                      <span className="text-sm font-semibold text-neutral-900">{r.total}/{r.maxPoints}</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {r.criteria.map((c, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="text-neutral-600">{c.name}</span>
                        <span className="text-neutral-500">{c.points}/{c.maxPoints}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsContent />
    </AppShell>
  );
}
