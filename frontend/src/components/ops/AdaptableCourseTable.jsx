'use client';

import { useRouter } from 'next/navigation';
import { FlightStatus } from '@/components/ui/aviation';
import { formatAttr, attrTone } from '@/services/data';
import { cx } from '@/components/ui/kit';

const TONE = { rose: 'text-rose-400', amber: 'text-amber-400', teal: 'text-emerald-400' };
const isNumeric = (t) => t === 'number' || t === 'currency' || t === 'date';

// Dark departures-board table with caller-chosen columns. Rows link to the course.
export default function AdaptableCourseTable({ courses = [], fields = [], cols = [] }) {
  const router = useRouter();
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const active = cols.map((k) => byKey[k]).filter(Boolean);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--board-line)]">
            <th className="sticky left-0 z-10 bg-board px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--board-ink-2)]">Course</th>
            {active.map((f) => (
              <th key={f.key} className={cx('whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--board-ink-2)]', isNumeric(f.type) && 'text-right')}>{f.label}</th>
            ))}
            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--board-ink-2)]">Status</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => {
            const a = c.attributes || {};
            return (
              <tr key={c.id} onClick={() => router.push(`/courses/${c.id}`)}
                className="cursor-pointer border-b border-[var(--board-line)] transition-colors hover:bg-[var(--board-2)]">
                <td className="sticky left-0 z-10 bg-board px-4 py-3 align-top">
                  <span className="block font-mono text-sm font-bold text-board-ink">{c.courseTypeCode || c.courseType || 'Course'}</span>
                  {c.externalRef && <span className="block font-mono text-[10px] text-[var(--board-ink-2)]">{c.externalRef}</span>}
                </td>
                {active.map((f) => {
                  const tone = attrTone(f.key, a[f.key]);
                  return (
                    <td key={f.key} className={cx('whitespace-nowrap px-3 py-3 text-sm', isNumeric(f.type) ? 'text-right font-mono tnum text-board-ink' : 'text-board-ink', tone && TONE[tone])}>
                      {formatAttr(a[f.key], f.type)}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-3 py-3"><FlightStatus status={c.compliance.status} onBoard /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
