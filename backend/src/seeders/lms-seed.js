import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import pgformat from 'pg-format';
import { query, getPool } from '../config/database.js';
import { ALS1_RULES, ALS2_RULES } from '../services/staffingEngine.js';

// Imports the 2000-course "National Resuscitation Training LMS" dataset into a
// dedicated org. Each course keeps its full source row in `attributes` (JSONB)
// so the board/cards can render adaptable columns. Status comes from the sheet's
// own Operational Status (it factors in venue/equipment/booking conflicts the
// engine doesn't model). Run: `npm run seed:lms` (idempotent).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORG = 'lms';
const ACCRED = 'lms_accred';
const T_ALS1 = 'lms_ctype_als1';
const T_ALS2 = 'lms_ctype_als2';
const CENTRES = ['Sydney', 'Wollongong', 'Newcastle', 'Canberra', 'Brisbane', 'Sunshine Coast', 'Gold Coast', 'Melbourne', 'Geelong', 'Adelaide'];

async function seed() {
  console.log('🌱 importing LMS 2000-course dataset...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'lms-courses.json'), 'utf8'));
  console.log(`   ${data.length} courses to import`);

  await query(
    `INSERT INTO organisations (id, name, accent, regions, tagline)
     VALUES ($1, 'National Resus LMS', '#1d4ed8', $2, 'Live LMS export — 2000 ALS courses, adaptable board.')
     ON CONFLICT (id) DO UPDATE SET accent = EXCLUDED.accent, regions = EXCLUDED.regions, tagline = EXCLUDED.tagline`,
    [ORG, CENTRES]
  );

  const pw = await bcrypt.hash('password', 10);
  await query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, roles)
     VALUES ('user_lms_admin', $1, 'admin@lms.example', $2, 'Ops', 'Control', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, roles = EXCLUDED.roles`,
    [ORG, pw, ['admin', 'organisation_admin', 'course_operations_manager']]
  );

  await query(
    `INSERT INTO accreditation_organisations (id, organisation_id, name, code)
     VALUES ($1, $2, 'Resuscitation Council', 'RC') ON CONFLICT (id) DO NOTHING`,
    [ACCRED, ORG]
  );
  await query(
    `INSERT INTO course_types (id, organisation_id, accreditation_org_id, name, code) VALUES
       ($1, $3, $4, 'Advanced Life Support 1', 'ALS1'),
       ($2, $3, $4, 'Advanced Life Support 2', 'ALS2')
     ON CONFLICT (id) DO NOTHING`,
    [T_ALS1, T_ALS2, ORG, ACCRED]
  );
  await query(
    `INSERT INTO rule_sets (id, course_type_id, version, rules) VALUES
       ('lms_rule_als1', $1, 1, $3),
       ('lms_rule_als2', $2, 1, $4)
     ON CONFLICT (id) DO UPDATE SET rules = EXCLUDED.rules`,
    [T_ALS1, T_ALS2, JSON.stringify(ALS1_RULES), JSON.stringify(ALS2_RULES)]
  );

  const rows = data.map((c) => {
    const als2 = c.type === 'ALS2';
    return [
      'lms_' + String(c.ref).replace(/-/g, '_'), ORG, `${c.type} — ${c.centre}`,
      ACCRED, als2 ? T_ALS2 : T_ALS1, c.centre,
      c.capacity, c.enrolled, c.waitlist ?? 0, c.status,
      c.start, c.end, c.groups, c.durationDays, c.ref, true,
      c.instructorsAssigned, als2 ? Boolean(c.cdAssigned) : null, als2 ? Boolean(c.mdAssigned) : null,
      als2 ? Boolean(c.cdAssigned) : null, als2 ? Boolean(c.mdAssigned) : null,
      JSON.stringify(c.attributes || {}),
    ];
  });

  const cols = '(id, organisation_id, name, accreditation_org_id, course_type_id, region, capacity, confirmed_students, waitlist_count, status, start_date, end_date, groups, duration_days, external_ref, imported, instructors_assigned, course_director_assigned, medical_director_assigned, cd_qualified, md_doctor, attributes)';
  const update = 'region=EXCLUDED.region, capacity=EXCLUDED.capacity, confirmed_students=EXCLUDED.confirmed_students, waitlist_count=EXCLUDED.waitlist_count, status=EXCLUDED.status, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, groups=EXCLUDED.groups, duration_days=EXCLUDED.duration_days, imported=true, instructors_assigned=EXCLUDED.instructors_assigned, course_director_assigned=EXCLUDED.course_director_assigned, medical_director_assigned=EXCLUDED.medical_director_assigned, cd_qualified=EXCLUDED.cd_qualified, md_doctor=EXCLUDED.md_doctor, attributes=EXCLUDED.attributes';

  let done = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await query(pgformat(`INSERT INTO courses ${cols} VALUES %L ON CONFLICT (id) DO UPDATE SET ${update}`, chunk));
    done += chunk.length;
    console.log(`   inserted ${done}/${rows.length}`);
  }

  // ---- Instructors (named) + credentials -------------------------------------
  const instructors = JSON.parse(fs.readFileSync(path.join(__dirname, 'lms-instructors.json'), 'utf8'));
  const insId = (ref) => 'lmsins_' + String(ref).replace(/-/g, '_');
  const insRefs = new Set(instructors.map((i) => i.ref));
  const insRows = instructors.map((i) => [
    insId(i.ref), ORG, i.first, i.last || '·',
    `${i.first}.${i.last || i.ref}.${i.ref}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@lms.example',
    i.centre, i.employment || null, i.qualified ? 'active' : 'candidate',
  ]);
  for (let i = 0; i < insRows.length; i += 200) {
    await query(pgformat(
      `INSERT INTO instructors (id, organisation_id, first_name, last_name, email, region, employment_type, status)
       VALUES %L ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, region = EXCLUDED.region`,
      insRows.slice(i, i + 200)));
  }
  const credRows = instructors.map((i) => {
    const roles = ['instructor'];
    if (i.cd) roles.push('course_director');
    if (i.md || i.profession === 'Doctor') { roles.push('medical_lead'); roles.push('doctor'); }
    return ['lmscred_' + String(i.ref).replace(/-/g, '_'), insId(i.ref), ACCRED, [T_ALS1, T_ALS2], roles, i.expiry || null];
  });
  for (let i = 0; i < credRows.length; i += 200) {
    await query(pgformat(
      `INSERT INTO instructor_credentials (id, instructor_id, accreditation_org_id, eligible_course_type_ids, eligible_roles, expires_at)
       VALUES %L ON CONFLICT (id) DO UPDATE SET eligible_roles = EXCLUDED.eligible_roles, expires_at = EXCLUDED.expires_at`,
      credRows.slice(i, i + 200)));
  }
  console.log(`   ${insRows.length} instructors + credentials`);

  // ---- Allocations (named crew per course) -----------------------------------
  const allocs = JSON.parse(fs.readFileSync(path.join(__dirname, 'lms-allocations.json'), 'utf8'));
  const courseId = (ref) => 'lms_' + String(ref).replace(/-/g, '_');
  const seenAlloc = new Set();
  const allocRows = [];
  for (const a of allocs) {
    if (!insRefs.has(a.ins)) continue;
    const key = `${a.course}|${a.ins}|${a.role}`;
    if (seenAlloc.has(key)) continue;
    seenAlloc.add(key);
    allocRows.push([courseId(a.course), insId(a.ins), a.role, a.status]);
  }
  for (let i = 0; i < allocRows.length; i += 200) {
    await query(pgformat(
      `INSERT INTO course_staffing (course_id, instructor_id, role, invitation_status)
       VALUES %L ON CONFLICT (course_id, instructor_id, role) DO UPDATE SET invitation_status = EXCLUDED.invitation_status`,
      allocRows.slice(i, i + 200)));
  }
  console.log(`   ${allocRows.length} allocations`);

  // ---- Students (synthesized from each course's enrolment count) --------------
  const FIRST = ['Olivia', 'Liam', 'Charlotte', 'Noah', 'Amelia', 'Jack', 'Mia', 'William', 'Ava', 'Lucas', 'Grace', 'Ethan', 'Chloe', 'Henry', 'Zoe', 'Leo', 'Ruby', 'Max', 'Ella', 'Sam'];
  const LAST = ['Nguyen', 'Smith', 'Patel', 'Williams', 'Chen', 'Brown', 'Singh', 'Jones', 'Wang', 'Taylor', 'Kaur', 'Wilson', 'Lee', 'Martin', 'Khan', 'White', 'Ali', 'Walker', 'Reddy', 'Hall'];
  let sc = 0;
  const learnerRows = []; const linkRows = [];
  for (const c of data) {
    const n = Math.max(0, c.enrolled || 0);
    for (let k = 0; k < n; k++) {
      const id = 'lmsstu_' + sc;
      learnerRows.push([id, ORG, FIRST[sc % FIRST.length], LAST[(sc * 7) % LAST.length], `stu${sc}@lms.example`, `${c.ref}-${k}`]);
      linkRows.push([courseId(c.ref), id]);
      sc++;
    }
  }
  for (let i = 0; i < learnerRows.length; i += 500) {
    await query(pgformat(
      `INSERT INTO learners (id, organisation_id, first_name, last_name, email, external_id)
       VALUES %L ON CONFLICT (id) DO NOTHING`, learnerRows.slice(i, i + 500)));
  }
  for (let i = 0; i < linkRows.length; i += 500) {
    await query(pgformat(
      `INSERT INTO course_learners (course_id, learner_id) VALUES %L ON CONFLICT DO NOTHING`,
      linkRows.slice(i, i + 500)));
  }
  console.log(`   ${learnerRows.length} students linked to courses`);

  const byStatus = {};
  for (const r of rows) { byStatus[r[9]] = (byStatus[r[9]] || 0) + 1; }
  console.log('✅ LMS import complete — org "lms", login admin@lms.example / password');
  console.log('   status mix:', JSON.stringify(byStatus));
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => { console.error('✖ LMS import failed:', err.message); process.exit(1); });
