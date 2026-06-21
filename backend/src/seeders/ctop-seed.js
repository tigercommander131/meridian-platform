import bcrypt from 'bcrypt';
import { query, getPool } from '../config/database.js';

// CTOP demo: a PARASOL tenant with ARC/RA accreditation, an ALS2 rule set,
// instructors with credentials, and one unstaffed demo course to staff.
// Run: `npm run seed:ctop` (idempotent).

const ORG = 'parasol';

async function seed() {
  console.log('🌱 seeding CTOP demo...');

  await query(`INSERT INTO organisations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [ORG, 'PARASOL']);

  const pw = await bcrypt.hash('password', 10);
  await query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, roles)
     VALUES ('user_parasol_admin', $1, 'admin@parasol.example', $2, 'Ops', 'Manager', $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, roles = EXCLUDED.roles`,
    [ORG, pw, ['admin', 'organisation_admin', 'course_operations_manager']]
  );

  await query(
    `INSERT INTO sites (id, organisation_id, name) VALUES
       ('site_parasol_syd', $1, 'PARASOL Sydney'),
       ('site_parasol_mel', $1, 'PARASOL Melbourne')
     ON CONFLICT (id) DO NOTHING`, [ORG]);

  await query(
    `INSERT INTO accreditation_organisations (id, organisation_id, name, code) VALUES
       ('accred_arc', $1, 'Australian Resuscitation Council', 'ARC'),
       ('accred_ra',  $1, 'Resuscitation Australia', 'RA')
     ON CONFLICT (id) DO NOTHING`, [ORG]);

  await query(
    `INSERT INTO course_types (id, organisation_id, accreditation_org_id, name, code) VALUES
       ('ctype_als2',   $1, 'accred_arc', 'Advanced Life Support 2', 'ALS2'),
       ('ctype_als1',   $1, 'accred_arc', 'Advanced Life Support 1', 'ALS1'),
       ('ctype_ra_als', $1, 'accred_ra',  'RA Advanced Life Support', 'RA-ALS')
     ON CONFLICT (id) DO NOTHING`, [ORG]);

  await query(
    `INSERT INTO rule_sets (id, course_type_id, version, rules, created_by)
     VALUES ('rule_als2_v1', 'ctype_als2', 1, $1, 'user_parasol_admin')
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify({
      groupSize: 6, instructorsPerGroup: 2, courseDirectorRequired: true, medicalLeadRequired: true,
      courseDirectorCanBeMedicalLead: true, extraDoctorWhenGroupsExceed: 2, countICsAsInstructors: false,
    })]
  );

  const instructors = [
    ['instr_1', 'Sarah', 'Chen', 'active', 'Sydney', ['instructor', 'course_director', 'medical_lead']],
    ['instr_2', 'Mark', 'Davies', 'active', 'Sydney', ['instructor']],
    ['instr_3', 'Priya', 'Nair', 'active', 'Melbourne', ['instructor', 'course_director']],
    ['instr_4', 'Tom', "O'Brien", 'active', 'Sydney', ['instructor', 'doctor']],
    ['instr_5', 'Liam', 'Walker', 'active', 'Sydney', ['instructor']],
    ['instr_6', 'Emma', 'Wright', 'candidate', 'Sydney', ['instructor']],
  ];
  for (const [id, fn, ln, status, region, roles] of instructors) {
    await query(
      `INSERT INTO instructors (id, organisation_id, first_name, last_name, status, region, employment_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'casual') ON CONFLICT (id) DO NOTHING`,
      [id, ORG, fn, ln, status, region]);
    await query(
      `INSERT INTO instructor_credentials (id, instructor_id, accreditation_org_id, eligible_course_type_ids, eligible_roles, expires_at)
       VALUES ($1, $2, 'accred_arc', ARRAY['ctype_als2'], $3, NOW() + INTERVAL '1 year')
       ON CONFLICT (id) DO NOTHING`,
      [`cred_${id}`, id, roles]);
  }

  // Unstaffed demo course (12 confirmed students → 2 groups → needs 4 instructors + CD + ML).
  await query(
    `INSERT INTO courses (id, organisation_id, name, accreditation_org_id, course_type_id, venue_site_id, region, capacity, confirmed_students, status, start_date)
     VALUES ('course_demo_als2', $1, 'ALS2 — Sydney (June)', 'accred_arc', 'ctype_als2', 'site_parasol_syd', 'Sydney', 18, 12, 'compliance_risk', NOW() + INTERVAL '14 days')
     ON CONFLICT (id) DO UPDATE SET region = EXCLUDED.region`, [ORG]);

  // Availability on the demo course date — most Sydney crew free; Mark unavailable.
  const availByInstr = { instr_1: 'available', instr_2: 'unavailable', instr_3: 'available', instr_4: 'available', instr_5: 'available', instr_6: 'available' };
  for (const [id, status] of Object.entries(availByInstr)) {
    await query(
      `INSERT INTO instructor_availability (instructor_id, available_on, status)
       VALUES ($1, (CURRENT_DATE + 14), $2)
       ON CONFLICT (instructor_id, available_on) DO UPDATE SET status = EXCLUDED.status`,
      [id, status]
    );
  }

  // Emma (candidate) is mid-IC1, mentored by Sarah.
  await query(
    `INSERT INTO ic_progress (id, instructor_id, stage, course_id, mentor_id, notes)
     VALUES ('ic_emma_1', 'instr_6', 'IC1', 'course_demo_als2', 'instr_1', 'Strong on debriefing; confidence building.')
     ON CONFLICT (id) DO NOTHING`);

  console.log('✅ CTOP seed complete — org "parasol", login admin@parasol.example / password');
  console.log('   ARC + RA, ALS2 rule set, 6 instructors (+availability), 1 IC1 candidate, 1 unstaffed demo course (12 students).');
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => { console.error('✖ CTOP seed failed:', err.message); process.exit(1); });
