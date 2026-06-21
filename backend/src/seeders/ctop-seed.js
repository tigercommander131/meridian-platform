import bcrypt from 'bcrypt';
import { query, getPool } from '../config/database.js';

// CTOP demo seed. Populates two tenants with a rich, airline-style operations
// picture: accreditation + rules, a regional crew (with credentials, expiry,
// availability, IC candidates) and courses spanning ready / at-risk / delivered.
// Idempotent (stable, org-prefixed ids). Run: `npm run seed:ctop`.

const ALS2_RULES = {
  groupSize: 6, minStudentsPerGroup: 4, instructorsPerGroup: 1, minGroups: 2,
  courseDirectorRequired: true, medicalDirectorRequired: true, courseDirectorCanBeMedicalDirector: true,
};

// crew: [key, first, last, region, employment, status, roles[], credExpiryInterval, availability{offset:status}]
const CREW = [
  ['sarah',  'Sarah', 'Chen',     'Sydney',    'employee',           'active',    ['instructor', 'course_director', 'medical_lead'], "1 year",  { 14: 'available', 30: 'available' }],
  ['mark',   'Mark',  'Davies',   'Sydney',    'casual',             'active',    ['instructor'],                                    "1 year",  { 14: 'available' }],
  ['priya',  'Priya', 'Nair',     'Melbourne', 'casual',             'active',    ['instructor', 'course_director'],                 "1 year",  { 30: 'available' }],
  ['tom',    'Tom',   "O'Brien",  'Sydney',    'medical_consultant', 'active',    ['instructor', 'doctor', 'medical_lead'],          "1 year",  { 14: 'available', 30: 'available' }],
  ['liam',   'Liam',  'Walker',   'Sydney',    'casual',             'active',    ['instructor'],                                    "1 year",  { 14: 'unavailable' }],
  ['aisha',  'Aisha', 'Khan',     'Brisbane',  'sole_trader',        'active',    ['instructor', 'assessor'],                        "1 year",  { 14: 'available', 21: 'available' }],
  ['noah',   'Noah',  'Smith',    'Melbourne', 'company',            'active',    ['instructor'],                                    "-2 month",{ 30: 'tentative' }],  // expired credential
  ['emma',   'Emma',  'Wright',   'Sydney',    'casual',             'candidate', ['instructor'],                                    "1 year",  { 14: 'available' }],
];

// courses: [key, name, ctype, region, students, capacity, status, startOffsetDays]
const COURSES = [
  ['c1', 'ALS2 — Sydney',    'als2', 'Sydney',    12, 18, 'ready',           14],
  ['c2', 'ALS2 — Melbourne', 'als2', 'Melbourne', 18, 24, 'compliance_risk', 30],
  ['c3', 'ALS1 — Brisbane',  'als1', 'Brisbane',   6, 12, 'compliance_risk', 21],
  ['c4', 'ALS2 — Sydney',    'als2', 'Sydney',    12, 18, 'delivered',      -30],
];

// staffing: [courseKey, crewKey, role, invitationStatus]
const STAFFING = [
  ['c1', 'sarah', 'course_director', 'accepted'],
  ['c1', 'mark',  'instructor',      'accepted'],
  ['c1', 'tom',   'instructor',      'accepted'],
  ['c1', 'aisha', 'instructor',      'accepted'],
  ['c1', 'priya', 'instructor',      'accepted'],
  ['c2', 'priya', 'course_director', 'accepted'],
  ['c2', 'noah',  'instructor',      'invited'],
  ['c2', 'mark',  'instructor',      'declined'],
  ['c3', 'aisha', 'instructor',      'invited'],
];

async function seedOrg({ prefix, orgId, orgName, accent, regions, tagline }) {
  const P = (s) => `${prefix}_${s}`;

  await query(
    `INSERT INTO organisations (id, name, accent, regions, tagline) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET accent = EXCLUDED.accent, regions = EXCLUDED.regions, tagline = EXCLUDED.tagline`,
    [orgId, orgName, accent, regions, tagline]
  );

  await query(
    `INSERT INTO accreditation_organisations (id, organisation_id, name, code) VALUES
       ($1, $3, 'Australian Resuscitation Council', 'ARC'),
       ($2, $3, 'Resuscitation Australia', 'RA')
     ON CONFLICT (id) DO NOTHING`,
    [P('accred_arc'), P('accred_ra'), orgId]
  );

  await query(
    `INSERT INTO course_types (id, organisation_id, accreditation_org_id, name, code) VALUES
       ($1, $4, $5, 'Advanced Life Support 2', 'ALS2'),
       ($2, $4, $5, 'Advanced Life Support 1', 'ALS1'),
       ($3, $4, $6, 'Paediatric Advanced Life Support', 'PALS')
     ON CONFLICT (id) DO NOTHING`,
    [P('ctype_als2'), P('ctype_als1'), P('ctype_pals'), orgId, P('accred_arc'), P('accred_ra')]
  );

  await query(
    `INSERT INTO rule_sets (id, course_type_id, version, rules) VALUES ($1, $2, 1, $3)
     ON CONFLICT (id) DO NOTHING`,
    [P('rule_als2'), P('ctype_als2'), JSON.stringify(ALS2_RULES)]
  );

  for (const [key, first, last, region, employment, status, roles, expiry, avail] of CREW) {
    const id = P(`instr_${key}`);
    const email = `${key}.${last.toLowerCase().replace(/[^a-z]/g, '')}@${prefix}.example`;
    await query(
      `INSERT INTO instructors (id, organisation_id, first_name, last_name, email, region, employment_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET region = EXCLUDED.region, status = EXCLUDED.status, email = EXCLUDED.email`,
      [id, orgId, first, last, email, region, employment, status]
    );
    await query(
      `INSERT INTO instructor_credentials (id, instructor_id, accreditation_org_id, eligible_course_type_ids, eligible_roles, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6)::interval)
       ON CONFLICT (id) DO NOTHING`,
      [P(`cred_${key}`), id, P('accred_arc'), [P('ctype_als2'), P('ctype_als1')], roles, expiry]
    );
    for (const [offset, st] of Object.entries(avail)) {
      await query(
        `INSERT INTO instructor_availability (instructor_id, available_on, status)
         VALUES ($1, (CURRENT_DATE + $2::int), $3)
         ON CONFLICT (instructor_id, available_on) DO UPDATE SET status = EXCLUDED.status`,
        [id, parseInt(offset, 10), st]
      );
    }
  }

  for (const [key, name, ctype, region, students, capacity, status, offset] of COURSES) {
    await query(
      `INSERT INTO courses (id, organisation_id, name, accreditation_org_id, course_type_id, region, capacity, confirmed_students, status, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (CURRENT_DATE + $10::int))
       ON CONFLICT (id) DO UPDATE SET region = EXCLUDED.region, confirmed_students = EXCLUDED.confirmed_students, status = EXCLUDED.status, start_date = EXCLUDED.start_date`,
      [P(`course_${key}`), orgId, name, P('accred_arc'), P(`ctype_${ctype}`), region, capacity, students, status, offset]
    );
  }

  for (const [ck, crewKey, role, inv] of STAFFING) {
    await query(
      `INSERT INTO course_staffing (course_id, instructor_id, role, invitation_status, responded_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 IN ('accepted','declined') THEN NOW() ELSE NULL END)
       ON CONFLICT (course_id, instructor_id, role) DO UPDATE SET invitation_status = EXCLUDED.invitation_status`,
      [P(`course_${ck}`), P(`instr_${crewKey}`), role, inv]
    );
  }

  // Emma mid-IC1, mentored by Sarah (after courses exist — FK on course_id).
  await query(
    `INSERT INTO ic_progress (id, instructor_id, stage, course_id, mentor_id, notes)
     VALUES ($1, $2, 'IC1', $3, $4, 'Strong on debriefing; confidence building.')
     ON CONFLICT (id) DO NOTHING`,
    [P('ic_emma'), P('instr_emma'), P('course_c1'), P('instr_sarah')]
  );
}

async function seed() {
  console.log('🌱 seeding CTOP demo...');

  const pw = await bcrypt.hash('password', 10);

  // Tenant 1: PARASOL (fresh demo org).
  await seedOrg({
    prefix: 'p', orgId: 'parasol', orgName: 'PARASOL',
    accent: '#0f766e', regions: ['Sydney', 'Melbourne', 'Brisbane'],
    tagline: 'Clinical training, run like an airline.',
  });
  await query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, roles)
     VALUES ('user_parasol_admin', 'parasol', 'admin@parasol.example', $1, 'Ops', 'Manager', $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, roles = EXCLUDED.roles`,
    [pw, ['admin', 'organisation_admin', 'course_operations_manager']]
  );

  // Tenant 2: the existing ATO demo org (so the default login has rich data).
  await query(`INSERT INTO organisations (id, name) VALUES ('ato', 'ATO Demo') ON CONFLICT (id) DO NOTHING`);
  await seedOrg({
    prefix: 'ato', orgId: 'ato', orgName: 'ATO Demo',
    accent: '#0f766e', regions: ['Sydney', 'Melbourne', 'Brisbane'],
    tagline: 'Operations control for accredited courses.',
  });

  console.log('✅ CTOP seed complete.');
  console.log('   Logins: admin@parasol.example / password  ·  admin@ato.example / password');
  console.log('   Each org: ARC+RA, ALS2/ALS1/PALS, 8 crew (1 candidate, 1 expired cred), availability, 4 courses (ready / at-risk / delivered).');
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => { console.error('✖ CTOP seed failed:', err.message); process.exit(1); });
