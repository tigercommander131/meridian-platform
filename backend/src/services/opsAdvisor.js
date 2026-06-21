// Deterministic operations advisor. Scans the org's courses and produces
// prioritized findings + concrete fix suggestions (no LLM required). The AI
// report layer (aiReport.js) turns these findings into a narrative when a
// Claude API key is configured.

const SEV_RANK = { high: 0, medium: 1, low: 2 };

// course shape: { id, name, type, region, status, enrolled, capacity, waitlist,
// groups, groupSize, minStudents, instructors:{assigned,required}, cdOk, mdOk, als2 }
export function analyze(courses, { groupSize = 6, maxGroups = 3 } = {}) {
  const findings = [];
  const add = (f) => findings.push(f);

  // Index by type+region for consolidation suggestions.
  const future = courses.filter((c) => !['delivered', 'closed', 'cancelled'].includes(c.status));
  const startById = {};
  for (const c of future) startById[c.id] = c.startDate || null;
  const byBucket = {};
  for (const c of future) {
    const key = `${c.type}|${c.region}`;
    (byBucket[key] = byBucket[key] || []).push(c);
  }

  for (const c of future) {
    const min = c.minStudents;

    // 1. Under minimum → not viable.
    if (c.enrolled > 0 && c.enrolled < min) {
      const sibling = (byBucket[`${c.type}|${c.region}`] || []).find(
        (o) => o.id !== c.id && (o.capacity - o.enrolled) >= c.enrolled && o.enrolled + c.enrolled <= o.capacity
      );
      const fewer = c.groups - 1;
      const canDropGroup = fewer >= (c.als2 ? 2 : 1) && c.enrolled >= 4 * fewer && c.enrolled <= groupSize * fewer;
      const action = sibling
        ? `Consolidate: move these ${c.enrolled} students into "${sibling.name}" (${sibling.capacity - sibling.enrolled} seats free), then cancel this course.`
        : canDropGroup
          ? `Reduce to ${c.groups - 1} group${c.groups - 1 === 1 ? '' : 's'} (min ${(c.groups - 1) * 4}) so the current ${c.enrolled} students make it viable.`
          : `Promote/marketing push to reach ${min - c.enrolled} more enrolments, or cancel and refund.`;
      add({ severity: 'high', type: 'underfilled', courseId: c.id, course: c.name,
        title: `Under minimum (${c.enrolled}/${min})`,
        detail: `"${c.name}" has ${c.enrolled} students but needs ${min} (${c.groups} group${c.groups === 1 ? '' : 's'} × 4) to run.`,
        action });
    }

    // 2. Excess waitlist → add capacity.
    if (c.waitlist > 0) {
      if (c.groups < maxGroups && c.waitlist >= 1) {
        const newGroups = Math.min(maxGroups, c.groups + Math.ceil(c.waitlist / groupSize));
        add({ severity: c.waitlist >= groupSize ? 'medium' : 'low', type: 'waitlist', courseId: c.id, course: c.name,
          title: `Waitlist of ${c.waitlist}`,
          detail: `"${c.name}" is full with ${c.waitlist} on the waitlist and only ${c.groups}/${maxGroups} groups.`,
          action: `Add a group (→ ${newGroups} groups, +${(newGroups - c.groups) * groupSize} seats, needs +${(newGroups - c.groups)} instructor${newGroups - c.groups === 1 ? '' : 's'}) to clear the waitlist.` });
      } else if (c.groups >= maxGroups && c.waitlist >= 4) {
        add({ severity: 'medium', type: 'waitlist', courseId: c.id, course: c.name,
          title: `Waitlist of ${c.waitlist} (course at max size)`,
          detail: `"${c.name}" is at the ${maxGroups}-group maximum with ${c.waitlist} waiting.`,
          action: `Schedule an additional ${c.type} course in ${c.region} (${c.waitlist} waiting → ~${Math.ceil(c.waitlist / groupSize)} group${Math.ceil(c.waitlist / groupSize) === 1 ? '' : 's'}).` });
      }
    }

    // 3. Over capacity.
    if (c.enrolled > c.capacity) {
      add({ severity: 'medium', type: 'overcapacity', courseId: c.id, course: c.name,
        title: `Over capacity (${c.enrolled}/${c.capacity})`,
        detail: `"${c.name}" has ${c.enrolled - c.capacity} more enrolments than seats.`,
        action: `Move ${c.enrolled - c.capacity} students to the waitlist or add a group.` });
    }

    // 4. Staffing gaps.
    const instrShort = c.instructors.required - c.instructors.assigned;
    if (instrShort > 0) {
      add({ severity: 'high', type: 'instructors', courseId: c.id, course: c.name,
        title: `${instrShort} instructor${instrShort === 1 ? '' : 's'} short`,
        detail: `"${c.name}" has ${c.instructors.assigned}/${c.instructors.required} instructors.`,
        action: `Invite ${instrShort} more instructor${instrShort === 1 ? '' : 's'} (use the course's standby list, local → regional → emergency).` });
    }
    if (c.als2 && !c.cdOk) {
      add({ severity: 'high', type: 'course_director', courseId: c.id, course: c.name,
        title: 'No accredited Course Director',
        detail: `"${c.name}" (ALS2) has no accredited Course Director assigned.`,
        action: 'Assign an instructor who holds Course Director accreditation.' });
    }
    if (c.als2 && !c.mdOk) {
      add({ severity: 'high', type: 'medical_director', courseId: c.id, course: c.name,
        title: 'No Medical Director (doctor)',
        detail: `"${c.name}" (ALS2) needs a Medical Director who is a registered doctor.`,
        action: 'Assign a doctor as Medical Director (the Course Director may cover this if they are a doctor).' });
    }
  }

  for (const f of findings) f.date = startById[f.courseId] || null;
  findings.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  const stats = {
    total: future.length,
    cleared: future.filter((c) => c.status === 'ready').length,
    atRisk: future.filter((c) => ['compliance_risk', 'staffing_risk', 'viability_risk'].includes(c.status)).length,
    underfilled: findings.filter((f) => f.type === 'underfilled').length,
    waitlistAlerts: findings.filter((f) => f.type === 'waitlist').length,
    staffingGaps: findings.filter((f) => ['instructors', 'course_director', 'medical_director'].includes(f.type)).length,
    totalWaitlisted: future.reduce((n, c) => n + (c.waitlist || 0), 0),
  };

  return { stats, findings };
}

// Plain-English fallback report (used when no Claude key is configured).
export function summaryText({ stats, findings }, orgName = 'your organisation') {
  if (findings.length === 0) {
    return `All ${stats.total} active courses at ${orgName} are on track — no viability, waitlist, or staffing issues detected.`;
  }
  const lines = [];
  lines.push(`${stats.atRisk} of ${stats.total} active courses need attention: ${stats.staffingGaps} staffing gap(s), ${stats.underfilled} under-minimum, ${stats.waitlistAlerts} waitlist pressure(s).`);
  const top = findings.slice(0, 8);
  for (const f of top) lines.push(`- [${f.severity.toUpperCase()}] ${f.course}: ${f.title}. ${f.action}`);
  if (findings.length > top.length) lines.push(`…and ${findings.length - top.length} more.`);
  return lines.join('\n');
}
