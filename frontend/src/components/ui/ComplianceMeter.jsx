// Per-role staffing meter: shows assigned vs required as small progress bars,
// driven by the staffing engine's compliance object.

function Row({ label, assigned, required, satisfiedNote }) {
  if (required === 0 && assigned === 0) return null;
  const pct = required > 0 ? Math.min(100, Math.round((assigned / required) * 100)) : 100;
  const ok = assigned >= required;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--ink-2)]">{label}</span>
        <span className={ok ? 'font-medium text-teal-700' : 'font-medium text-amber-700'}>
          {assigned}/{required}{satisfiedNote ? ` · ${satisfiedNote}` : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full transition-all ${ok ? 'bg-teal-600' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ComplianceMeter({ compliance }) {
  if (!compliance) return null;
  const { required, assigned } = compliance;
  const mlNote = required.medical_lead > 0 && assigned.medical_lead === 0 && assigned.course_director > 0 ? 'via CD' : '';
  return (
    <div className="space-y-2.5">
      <Row label="Instructors" assigned={assigned.instructors} required={required.instructors} />
      <Row label="Course director" assigned={assigned.course_director} required={required.course_director} />
      <Row label="Medical lead" assigned={mlNote ? required.medical_lead : assigned.medical_lead} required={required.medical_lead} satisfiedNote={mlNote} />
      <Row label="Doctor" assigned={assigned.doctor} required={required.doctor} />
    </div>
  );
}
