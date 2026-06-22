import { query } from '../config/database.js';
import { complianceFor } from './staffingController.js';
import { resolveCurrentRules } from './accreditationController.js';
import { evaluate } from '../services/staffingEngine.js';
import { sendEmail, emailEnabled, invitationTemplate } from '../services/emailService.js';
import { config } from '../config/environment.js';
import crypto from 'crypto';

// Reverse of staffingController's SHEET_STATUS — used to refresh an imported
// course's stored Operational Status after AI mutations so the board + the
// sheet-status override reflect the change.
const ENG_TO_SHEET = {
  ready: 'Ready to Run', staffing_risk: 'At Risk',
  compliance_risk: 'Critical Intervention', viability_risk: 'Recruit Students / Consider Merge',
};

// AI course actions — a deterministic planner that proposes concrete fixes for a
// single course (who to contact, what to change), and an apply step that the user
// confirms. Plans are re-derived server-side on apply so only actions we actually
// generated can run (the client just sends the ids it ticked).

const ROLE_LABEL = { instructor: 'Instructor', course_director: 'Course Director', medical_lead: 'Medical Director' };

async function courseRow(courseId, orgId) {
  const r = await query(
    `SELECT c.*, ct.code AS course_type_code, ct.name AS course_type_name
     FROM courses c LEFT JOIN course_types ct ON ct.id = c.course_type_id
     WHERE c.id = $1 AND c.organisation_id = $2`,
    [courseId, orgId]
  );
  return r.rows[0] || null;
}

// Ranked eligible + available instructors for a role (local → regional → emergency),
// excluding anyone already assigned that role on the course.
async function candidates(orgId, course, role, limit) {
  const r = await query(
    `SELECT i.id, i.first_name, i.last_name, i.email, i.region, i.status, i.employment_type,
            EXISTS (SELECT 1 FROM instructor_credentials c
              WHERE c.instructor_id = i.id AND $2 = ANY (c.eligible_roles)
                AND (c.expires_at IS NULL OR c.expires_at > NOW())
                AND (cardinality(c.eligible_course_type_ids) = 0 OR $3::text IS NULL OR $3 = ANY (c.eligible_course_type_ids))) AS eligible,
            (SELECT status FROM instructor_availability a WHERE a.instructor_id = i.id AND a.available_on = $4::date) AS avail_status,
            EXISTS (SELECT 1 FROM course_staffing s WHERE s.course_id = $5 AND s.instructor_id = i.id AND s.role = $2) AS already
     FROM instructors i
     WHERE i.organisation_id = $1 AND i.status <> 'inactive'`,
    [orgId, role, course.course_type_id, course.start_date, course.id]
  );
  const tierRank = { local: 0, regional: 1, emergency: 2 };
  const availRank = { available: 0, unknown: 1, tentative: 2 };
  return r.rows
    .filter((i) => i.eligible && i.avail_status !== 'unavailable' && !i.already)
    .map((i) => {
      const availability = i.avail_status || 'unknown';
      const tier = i.status === 'candidate' ? 'emergency'
        : (course.region && i.region && course.region.toLowerCase() === i.region.toLowerCase()) ? 'local' : 'regional';
      return { instructorId: i.id, name: `${i.first_name} ${i.last_name}`.trim(), email: i.email, region: i.region, tier, availability };
    })
    .sort((a, b) => (tierRank[a.tier] - tierRank[b.tier]) || (availRank[a.availability] - availRank[b.availability]) || a.name.localeCompare(b.name));
}

// Build the proposed action list for a course.
async function planFor(course, orgId) {
  const compliance = await complianceFor(course);
  const req = compliance.required, asg = compliance.assigned;
  const actions = [];

  const instrShort = Math.max(0, (req.instructors || 0) - (asg.instructors || 0));
  if (instrShort > 0) {
    const pool = await candidates(orgId, course, 'instructor', instrShort);
    for (const c of pool.slice(0, instrShort)) {
      actions.push({ id: `invite_instructor:${c.instructorId}`, type: 'invite_instructor', severity: 'high',
        label: `Invite ${c.name} as Instructor`,
        detail: `${c.tier} · ${c.availability} availability${c.region ? ` · ${c.region}` : ''}. Sends an invitation (email) to confirm.`,
        who: c.name, role: 'instructor' });
    }
    if (pool.length < instrShort) {
      actions.push({ id: 'instr_shortfall', type: 'note', severity: 'high', label: `${instrShort - pool.length} more instructor(s) still needed`,
        detail: 'No more eligible/available instructors in the pool — recruit or escalate manually.', disabled: true });
    }
  }

  if ((req.course_director || 0) > (asg.course_director || 0)) {
    const pool = await candidates(orgId, course, 'course_director', 1);
    const c = pool[0];
    if (c) actions.push({ id: `assign_course_director:${c.instructorId}`, type: 'assign_course_director', severity: 'high',
      label: `Assign ${c.name} as Course Director`, detail: `Accredited CD · ${c.tier}. Sends an invitation to confirm.`, who: c.name, role: 'course_director' });
    else actions.push({ id: 'cd_none', type: 'note', severity: 'high', label: 'No accredited Course Director available', detail: 'No eligible CD in the pool — recruit one.', disabled: true });
  }

  if ((req.medical_lead || 0) > (asg.medical_lead || 0)) {
    const pool = await candidates(orgId, course, 'medical_lead', 1);
    const c = pool[0];
    if (c) actions.push({ id: `assign_medical_director:${c.instructorId}`, type: 'assign_medical_director', severity: 'high',
      label: `Assign ${c.name} as Medical Director`, detail: `Registered doctor · ${c.tier}. Sends an invitation to confirm.`, who: c.name, role: 'medical_lead' });
    else actions.push({ id: 'md_none', type: 'note', severity: 'high', label: 'No eligible Medical Director (doctor) available', detail: 'No eligible doctor in the pool — recruit one.', disabled: true });
  }

  const overflow = Math.max(0, (course.confirmed_students || 0) - (course.capacity || 0));
  if (overflow > 0) {
    actions.push({ id: 'move_overflow_waitlist', type: 'move_overflow_waitlist', severity: 'medium',
      label: `Move ${overflow} student(s) to the waitlist`, detail: `Enrolled ${course.confirmed_students} exceeds capacity ${course.capacity}. Trims enrolment to ${course.capacity} and adds ${overflow} to the waitlist.` });
  }

  const wl = course.waitlist_count || 0;
  const cap = course.capacity || (compliance.groups || 1) * 6;
  if (wl >= 4) {
    const move = Math.min(wl, cap);
    actions.push({ id: 'open_extra_course', type: 'open_extra_course', severity: 'medium',
      label: `Open an extra ${course.course_type_code || 'course'} and promote ${move} waitlisted`,
      detail: `Creates a new planning course at ${course.region || 'the same centre'} seeded with ${move} students from the waitlist of ${wl}.` });
  }

  return { compliance, actions };
}

// GET /api/courses/:courseId/ai-plan
export async function aiPlan(req, res, next) {
  try {
    const course = await courseRow(req.params.courseId, req.user.organisationId);
    if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    const { compliance, actions } = await planFor(course, req.user.organisationId);
    res.json({ courseId: course.id, courseName: course.name, status: compliance.status, emailEnabled: emailEnabled(), actions });
  } catch (err) { next(err); }
}

async function audit(orgId, userId, courseId, detail) {
  await query(
    `INSERT INTO audit_events (organisation_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'course.ai_fix', 'course', $3, $4)`,
    [orgId, userId, courseId, JSON.stringify(detail)]
  );
}

async function inviteInstructor(course, orgId, userId, instructorId, role, results) {
  const ins = await query(`SELECT first_name, last_name, email FROM instructors WHERE id = $1 AND organisation_id = $2`, [instructorId, orgId]);
  if (ins.rowCount === 0) { results.push({ ok: false, message: 'Instructor not found' }); return; }
  const name = `${ins.rows[0].first_name} ${ins.rows[0].last_name}`.trim();
  const token = crypto.randomBytes(16).toString('hex');
  const up = await query(
    `INSERT INTO course_staffing (course_id, instructor_id, role, invitation_status, invite_token, invited_at)
     VALUES ($1, $2, $3, 'invited', $4, NOW())
     ON CONFLICT (course_id, instructor_id, role) DO NOTHING RETURNING id`,
    [course.id, instructorId, role, token]
  );
  if (up.rowCount === 0) { results.push({ ok: false, message: `${name} already assigned as ${ROLE_LABEL[role]}` }); return; }
  // Reflect on imported (count-based) courses so compliance improves.
  if (course.imported) {
    if (role === 'instructor') await query(`UPDATE courses SET instructors_assigned = COALESCE(instructors_assigned,0) + 1 WHERE id = $1`, [course.id]);
    if (role === 'course_director') await query(`UPDATE courses SET course_director_assigned = true, cd_qualified = true WHERE id = $1`, [course.id]);
    if (role === 'medical_lead') await query(`UPDATE courses SET medical_director_assigned = true, md_doctor = true WHERE id = $1`, [course.id]);
  }
  let contacted = 'logged (no email connector)';
  if (emailEnabled() && ins.rows[0].email) {
    const base = `${config.appUrl.replace(/\/$/, '')}/invite/${token}`;
    try {
      const rl = ROLE_LABEL[role] || role;
      await sendEmail({ to: ins.rows[0].email, subject: `Invitation: ${rl} — ${course.name}`,
        ...invitationTemplate({ instructorName: ins.rows[0].first_name, courseName: course.name, roleLabel: rl,
          startDate: course.start_date, message: 'Auto-generated by the AI operations assistant.',
          acceptUrl: `${base}?r=accept`, declineUrl: `${base}?r=decline` }) });
      contacted = `emailed ${ins.rows[0].email}`;
    } catch { contacted = 'email failed — invitation still created'; }
  }
  results.push({ ok: true, message: `Invited ${name} as ${ROLE_LABEL[role]} (${contacted})` });
}

// POST /api/courses/:courseId/ai-apply  { actionIds: [...] }
export async function aiApply(req, res, next) {
  try {
    const course = await courseRow(req.params.courseId, req.user.organisationId);
    if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND', status: 404 });
    const wanted = new Set(Array.isArray(req.body?.actionIds) ? req.body.actionIds : []);
    if (wanted.size === 0) return res.status(400).json({ error: 'actionIds required', code: 'VALIDATION_ERROR', status: 400 });

    const orgId = req.user.organisationId;
    const { actions } = await planFor(course, orgId);          // re-derive: only apply what we generated
    const toRun = actions.filter((a) => wanted.has(a.id) && !a.disabled && a.type !== 'note');
    const results = [];

    for (const a of toRun) {
      if (a.type === 'invite_instructor' || a.type === 'assign_course_director' || a.type === 'assign_medical_director') {
        const instructorId = a.id.split(':')[1];
        await inviteInstructor(course, orgId, req.user.sub, instructorId, a.role, results);
      } else if (a.type === 'move_overflow_waitlist') {
        const overflow = Math.max(0, (course.confirmed_students || 0) - (course.capacity || 0));
        if (overflow > 0) {
          await query(`UPDATE courses SET confirmed_students = capacity, waitlist_count = COALESCE(waitlist_count,0) + $2 WHERE id = $1`, [course.id, overflow]);
          results.push({ ok: true, message: `Moved ${overflow} student(s) to the waitlist` });
        } else results.push({ ok: false, message: 'No overflow to move' });
      } else if (a.type === 'open_extra_course') {
        const wl = course.waitlist_count || 0;
        const cap = course.capacity || 18;
        const move = Math.min(wl, cap);
        if (move > 0) {
          const extraAttrs = course.imported ? {
            'Course Type': course.course_type_code, 'Centre': course.region, 'Region': course.attributes?.Region || course.region,
            'Capacity': cap, 'Enrolled': move, 'Waitlist': 0, 'Groups': course.groups,
            'Operational Status': 'Recruit Students / Consider Merge', 'Risk Rating': 'Moderate',
          } : {};
          const nc = await query(
            `INSERT INTO courses (organisation_id, name, accreditation_org_id, course_type_id, region, capacity, confirmed_students, status, groups, duration_days, imported, attributes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'planning',$8,$9,$10,$11) RETURNING id`,
            [orgId, `${course.course_type_code || course.name} — ${course.region || 'extra'} (extra)`, course.accreditation_org_id, course.course_type_id,
             course.region, cap, move, course.groups, course.duration_days, course.imported, JSON.stringify(extraAttrs)]
          );
          await query(`UPDATE courses SET waitlist_count = COALESCE(waitlist_count,0) - $2 WHERE id = $1`, [course.id, move]);
          results.push({ ok: true, message: `Opened extra course (${nc.rows[0].id}) with ${move} promoted student(s)`, newCourseId: nc.rows[0].id });
        } else results.push({ ok: false, message: 'No waitlist to promote' });
      }
    }

    // Recompute + persist this course's status after the changes.
    const fresh = await courseRow(course.id, orgId);
    let status;
    if (fresh.imported) {
      // Drive status from the engine on the fresh counts, and sync the stored
      // attributes so the adaptable board (which renders attributes) and the
      // sheet-status override both reflect the fix.
      const rules = await resolveCurrentRules(fresh.course_type_id);
      const eng = evaluate({
        ruleSet: rules, groups: fresh.groups, enrolled: fresh.confirmed_students, instructors: fresh.instructors_assigned,
        courseDirector: Boolean(fresh.course_director_assigned) && fresh.cd_qualified !== false,
        medicalDirector: Boolean(fresh.medical_director_assigned) && fresh.md_doctor !== false,
      });
      status = eng.status;
      const patch = {
        'Enrolled': fresh.confirmed_students, 'Waitlist': fresh.waitlist_count, 'Instructors Assigned': fresh.instructors_assigned,
        'Operational Status': ENG_TO_SHEET[status] || 'At Risk', 'Can Run': eng.canRun ? 'Yes' : 'No',
      };
      if (fresh.course_director_assigned) patch['Course Director Assigned'] = 'Yes';
      if (fresh.medical_director_assigned) patch['Medical Director Assigned'] = 'Yes';
      await query(`UPDATE courses SET attributes = attributes || $1::jsonb, status = $2 WHERE id = $3`, [JSON.stringify(patch), status, course.id]);
    } else {
      status = (await complianceFor(fresh)).status;
      await query(`UPDATE courses SET status = $1 WHERE id = $2`, [status, course.id]);
    }
    await audit(orgId, req.user.sub, course.id, { applied: results.map((r) => r.message), status });

    res.json({ courseId: course.id, applied: results, status });
  } catch (err) { next(err); }
}
