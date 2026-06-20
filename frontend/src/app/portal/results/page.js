'use client';

import { useEffect, useState } from 'react';
import StudentShell from '@/components/layout/StudentShell';
import { studentApi } from '@/services/data';

function Results() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setReport(await studentApi.results());
      } catch {
        setReport({ summary: { assessed: 0, averagePercent: 0 }, results: [] });
      }
    })();
  }, []);

  if (!report) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">My results</h1>
      <p className="mt-1 text-sm text-neutral-500">Only results your assessor has released are shown.</p>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex gap-10">
          <div>
            <p className="text-xs text-neutral-500">Assessed</p>
            <p className="text-2xl font-semibold text-neutral-900">{report.summary.assessed}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Average</p>
            <p className="text-2xl font-semibold text-neutral-900">{report.summary.averagePercent}%</p>
          </div>
        </div>
      </div>

      {report.results.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No released results yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {report.results.map((r) => (
            <div key={r.scoreId} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">{r.scenarioName}</p>
                <span className="text-sm font-semibold text-teal-700">{r.percent}%</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                {r.rubricName}{r.role ? ` · ${r.role.replace(/_/g, ' ')}` : ''} · {r.total}/{r.maxPoints}
              </p>
              <ul className="mt-3 space-y-1">
                {r.criteria.map((c, i) => (
                  <li key={i} className="flex justify-between text-xs text-neutral-600">
                    <span>{c.name}</span>
                    <span className="text-neutral-400">{c.points}/{c.maxPoints}</span>
                  </li>
                ))}
              </ul>
              {r.assessorNotes && <p className="mt-3 rounded-md bg-neutral-50 p-2 text-xs text-neutral-600">{r.assessorNotes}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function ResultsPage() {
  return (
    <StudentShell>
      <Results />
    </StudentShell>
  );
}
