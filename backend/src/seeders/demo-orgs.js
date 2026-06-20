import bcrypt from 'bcrypt';
import { getPool, query } from '../config/database.js';

// Demo training organisations for Indigo Learning.
// Run: `npm run seed:demo`  (idempotent — safe to re-run).
//
// Creates 3 orgs, their sites, an admin login each, and for every course type
// the org runs: a rubric (+criteria), a concrete course, and a sample cohort
// with learners so it's runnable end-to-end.

// Course catalogue — each type defines a rubric (criteria sum to 100).
const COURSE_TYPES = {
  ALS: {
    title: 'Advanced Life Support',
    scenario: 'scenario_als_adult',
    role: 'team_lead',
    criteria: [
      ['Assessment & high-quality CPR', 'Rapid assessment; compressions 50-60mm, 100-120/min', 25, 'flightRecorder.compressionDepthMM'],
      ['Rhythm recognition', 'Correctly identifies shockable vs non-shockable', 20, null],
      ['Defibrillation safety & timing', 'Safe, timely defibrillation', 25, 'flightRecorder.timeToFirstShock'],
      ['Drug administration', 'Correct ALS drugs and timing', 15, null],
      ['Team leadership & communication', 'Clear closed-loop communication', 15, null],
    ],
  },
  ATLS: {
    title: 'Advanced Trauma Life Support',
    scenario: 'scenario_atls_trauma',
    role: 'team_lead',
    criteria: [
      ['Primary survey (ABCDE)', 'Systematic ABCDE sequence', 25, null],
      ['Airway with C-spine control', 'Secures airway, protects cervical spine', 20, null],
      ['Breathing & ventilation', 'Identifies and treats breathing threats', 15, null],
      ['Circulation & haemorrhage control', 'Controls bleeding, restores perfusion', 25, null],
      ['Disability & exposure', 'Neuro assessment, full exposure', 15, null],
    ],
  },
  APLS: {
    title: 'Advanced Paediatric Life Support',
    scenario: 'scenario_apls_paed',
    role: 'team_lead',
    criteria: [
      ['Paediatric assessment triangle', 'Appearance, work of breathing, circulation', 20, null],
      ['Airway & breathing support', 'Age-appropriate airway management', 25, null],
      ['Circulation & access', 'IV/IO access, fluid resuscitation', 20, null],
      ['Weight-based drug dosing', 'Correct mg/kg dosing', 20, null],
      ['Family-centred communication', 'Communicates with family and team', 15, null],
    ],
  },
  PALS: {
    title: 'Paediatric Advanced Life Support',
    scenario: 'scenario_pals_paed',
    role: 'team_lead',
    criteria: [
      ['Initial impression & assessment', 'Rapid paediatric assessment', 20, null],
      ['Effective ventilation/oxygenation', 'Bag-mask and oxygenation', 25, 'flightRecorder.ventilationRate'],
      ['Rhythm recognition (paeds)', 'Identifies paediatric arrest rhythms', 20, null],
      ['Weight-based medication & defib energy', 'Correct doses and joules/kg', 20, null],
      ['Team dynamics', 'Effective resuscitation team behaviours', 15, null],
    ],
  },
};

// Organisations — code, sites (cities), and the course types each runs.
const ORGS = [
  { id: 'ato', name: 'Armstrong Training Organisation', code: 'ATO', sites: ['Sydney', 'Canberra', 'Newcastle'], courses: ['ALS', 'PALS'] },
  { id: 'brc', name: 'Buzz Resuscitation Council', code: 'BRC', sites: ['Melbourne', 'Geelong', 'Adelaide'], courses: ['ALS', 'APLS', 'ATLS'] },
  { id: 'csc', name: 'Collins Simulation Courses', code: 'CSC', sites: ['Brisbane', 'Gold Coast', 'Sunshine Coast'], courses: ['PALS', 'APLS', 'ATLS'] },
];

const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie'];
const LAST_NAMES = ['Walker', 'Reed', 'Foster', 'Hayes', 'Brooks', 'Sutton', 'Mercer', 'Lowe'];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');

async function seed() {
  console.log('🌱 seeding demo organisations...');
  const passwordHash = await bcrypt.hash('password', 10);
  let courseN = 0;

  for (const org of ORGS) {
    await query(`INSERT INTO organisations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [org.id, org.name]);

    // Sites
    for (const city of org.sites) {
      await query(
        `INSERT INTO sites (id, organisation_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [`site_${org.id}_${slug(city)}`, org.id, `${org.code} ${city}`]
      );
    }
    const primarySite = `site_${org.id}_${slug(org.sites[0])}`;

    // Admin login
    await query(
      `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, roles)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [`user_${org.id}_admin`, org.id, `admin@${org.id}.example`, passwordHash, org.code, 'Admin', ['admin', 'educator']]
    );

    // Learners (shared pool per org)
    const learnerIds = [];
    for (let i = 0; i < 4; i++) {
      const lid = `learner_${org.id}_${i + 1}`;
      learnerIds.push(lid);
      await query(
        `INSERT INTO learners (id, organisation_id, first_name, last_name, email, external_id)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (organisation_id, email) DO NOTHING`,
        [lid, org.id, FIRST_NAMES[i], LAST_NAMES[i], `${FIRST_NAMES[i].toLowerCase()}.${LAST_NAMES[i].toLowerCase()}@${org.id}.example`, `${org.code}-${1000 + i}`]
      );
    }

    // For each course type the org runs: rubric + criteria + course (+ cohort on the first one)
    let firstCourseId = null;
    for (const type of org.courses) {
      const def = COURSE_TYPES[type];
      const rubricId = `rubric_${org.id}_${slug(type)}`;
      await query(
        `INSERT INTO rubrics (id, organisation_id, name, scenario_id, role, version, max_score)
         VALUES ($1, $2, $3, $4, $5, '1.0', 100) ON CONFLICT (id) DO NOTHING`,
        [rubricId, org.id, `${type} — ${def.title}`, def.scenario, def.role]
      );
      let order = 1;
      for (const [name, desc, pts, evidence] of def.criteria) {
        await query(
          `INSERT INTO rubric_criteria (id, rubric_id, name, description, max_points, evidence_field, ordering)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [`crit_${org.id}_${slug(type)}_${order}`, rubricId, name, desc, pts, evidence, order]
        );
        order++;
      }

      courseN++;
      const month = String((courseN % 12) + 1).padStart(2, '0');
      const courseId = `course_${org.id}_${slug(type)}`;
      if (!firstCourseId) firstCourseId = courseId;
      await query(
        `INSERT INTO courses (id, organisation_id, site_id, name, start_date, end_date, max_learners, status)
         VALUES ($1, $2, $3, $4, $5, $6, 24, 'active') ON CONFLICT (id) DO NOTHING`,
        [courseId, org.id, primarySite, `${type} — ${org.sites[0]} 2026`, `2026-${month}-10T09:00:00Z`, `2026-${month}-11T17:00:00Z`]
      );
    }

    // Sample cohort on the org's first course, with all learners attached.
    const cohortId = `cohort_${org.id}_a`;
    await query(
      `INSERT INTO cohorts (id, course_id, name, description, qr_code)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [cohortId, firstCourseId, `${org.code} — Cohort A`, 'Sample cohort', `COHORT_${cohortId}`]
    );
    for (const lid of learnerIds) {
      await query(`INSERT INTO cohort_learners (cohort_id, learner_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [cohortId, lid]);
    }

    console.log(`  ✓ ${org.code}: ${org.sites.length} sites, ${org.courses.length} courses (${org.courses.join(', ')}), login admin@${org.id}.example`);
  }

  console.log('✅ demo orgs seeded (password for every admin: "password")');
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✖ demo seed failed:', err.message);
  process.exit(1);
});
