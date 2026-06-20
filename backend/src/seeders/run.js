import bcrypt from 'bcrypt';
import { query, getPool } from '../config/database.js';

async function seed() {
  console.log('🌱 seeding...');

  // Organisation
  await query(
    `INSERT INTO organisations (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    ['parasol-emt', 'PARASOL EMT']
  );

  // Sites
  await query(
    `INSERT INTO sites (id, organisation_id, name, address, coordinator)
     VALUES
       ('site_sydney', 'parasol-emt', 'Sydney Training Center', '123 Medical Way, Sydney NSW 2000', 'John Smith'),
       ('site_melbourne', 'parasol-emt', 'Melbourne Training Center', '456 Health Lane, Melbourne VIC 3000', 'Jane Doe')
     ON CONFLICT (id) DO NOTHING`
  );

  // Instructor user — real credentials replacing the Day 1 stub
  const passwordHash = await bcrypt.hash('password', 10);
  await query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, roles)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ['user_001', 'parasol-emt', 'instructor@parasol.edu.au', passwordHash, 'Sarah', 'Johnson', ['educator', 'observer']]
  );

  // Learners — a class of ten.
  await query(
    `INSERT INTO learners (id, organisation_id, first_name, last_name, email, external_id)
     VALUES
       ('learner_001', 'parasol-emt', 'John',    'Smith',    'john.smith@hospital.edu.au',    'HR_2026_001'),
       ('learner_002', 'parasol-emt', 'Jane',    'Doe',      'jane.doe@hospital.edu.au',      'HR_2026_002'),
       ('learner_003', 'parasol-emt', 'Liam',    'Nguyen',   'liam.nguyen@hospital.edu.au',   'HR_2026_003'),
       ('learner_004', 'parasol-emt', 'Olivia',  'Brown',    'olivia.brown@hospital.edu.au',  'HR_2026_004'),
       ('learner_005', 'parasol-emt', 'Noah',    'Patel',    'noah.patel@hospital.edu.au',    'HR_2026_005'),
       ('learner_006', 'parasol-emt', 'Emma',    'Wilson',   'emma.wilson@hospital.edu.au',   'HR_2026_006'),
       ('learner_007', 'parasol-emt', 'William', 'Chen',     'william.chen@hospital.edu.au',  'HR_2026_007'),
       ('learner_008', 'parasol-emt', 'Ava',     'Martinez', 'ava.martinez@hospital.edu.au',  'HR_2026_008'),
       ('learner_009', 'parasol-emt', 'James',   'Kim',      'james.kim@hospital.edu.au',     'HR_2026_009'),
       ('learner_010', 'parasol-emt', 'Sophia',  'Taylor',   'sophia.taylor@hospital.edu.au', 'HR_2026_010')
     ON CONFLICT (organisation_id, email) DO NOTHING`
  );

  // Courses — two active, one completed.
  await query(
    `INSERT INTO courses (id, organisation_id, site_id, name, start_date, end_date, max_learners, status)
     VALUES
       ('course_als_2026_01', 'parasol-emt', 'site_sydney',    'ALS — June 2026 Batch A', '2026-06-22T09:00:00Z', '2026-06-23T17:00:00Z', 24, 'active'),
       ('course_als_2026_02', 'parasol-emt', 'site_melbourne', 'ALS — July 2026 Batch B', '2026-07-13T09:00:00Z', '2026-07-14T17:00:00Z', 24, 'active'),
       ('course_bls_2026_01', 'parasol-emt', 'site_sydney',    'BLS Refresher — May 2026', '2026-05-04T09:00:00Z', '2026-05-04T17:00:00Z', 30, 'completed')
     ON CONFLICT (id) DO NOTHING`
  );

  // Cohorts — one per course, each with a check-in QR token.
  await query(
    `INSERT INTO cohorts (id, course_id, name, description, qr_code)
     VALUES
       ('cohort_als_a', 'course_als_2026_01', 'June A — Team 1', 'Adult VF resuscitation', 'COHORT_cohort_als_a'),
       ('cohort_als_b', 'course_als_2026_02', 'July B — Team 1', 'Adult VF resuscitation', 'COHORT_cohort_als_b'),
       ('cohort_bls_a', 'course_bls_2026_01', 'May Refresher',   'BLS adult refresher',    'COHORT_cohort_bls_a')
     ON CONFLICT (id) DO NOTHING`
  );

  // Cohort membership.
  await query(
    `INSERT INTO cohort_learners (cohort_id, learner_id)
     VALUES
       ('cohort_als_a', 'learner_001'), ('cohort_als_a', 'learner_002'),
       ('cohort_als_a', 'learner_003'), ('cohort_als_a', 'learner_004'),
       ('cohort_als_b', 'learner_005'), ('cohort_als_b', 'learner_006'),
       ('cohort_als_b', 'learner_007'),
       ('cohort_bls_a', 'learner_008'), ('cohort_bls_a', 'learner_009'),
       ('cohort_bls_a', 'learner_010')
     ON CONFLICT DO NOTHING`
  );

  // Rubric (ALS VF Adult — Team Lead)
  await query(
    `INSERT INTO rubrics (id, organisation_id, name, scenario_id, role, version, max_score)
     VALUES ('rubric_als_vf_adult_team_lead', 'parasol-emt', 'ALS VF - Adult (Team Lead)', 'scenario_vf_adult', 'team_lead', '1.0', 100)
     ON CONFLICT (id) DO NOTHING`
  );
  await query(
    `INSERT INTO rubric_criteria (id, rubric_id, name, description, max_points, evidence_field, ordering)
     VALUES
       ('criterion_001', 'rubric_als_vf_adult_team_lead', 'Assessment of Responsiveness', 'Correctly assesses patient responsiveness', 5, NULL, 1),
       ('criterion_002', 'rubric_als_vf_adult_team_lead', 'Initiation of CPR', 'Initiates high-quality CPR within 10 seconds', 10, 'flightRecorder.timeToFirstCompression', 2),
       ('criterion_003', 'rubric_als_vf_adult_team_lead', 'Compression Depth', 'Achieves 50-60mm depth', 10, 'flightRecorder.compressionDepthMM', 3)
     ON CONFLICT (id) DO NOTHING`
  );

  // Rubric (BLS Adult) — gives the BLS course something to score against.
  await query(
    `INSERT INTO rubrics (id, organisation_id, name, scenario_id, role, version, max_score)
     VALUES ('rubric_bls_adult', 'parasol-emt', 'BLS - Adult', 'scenario_bls_adult', 'compressor', '1.0', 100)
     ON CONFLICT (id) DO NOTHING`
  );
  await query(
    `INSERT INTO rubric_criteria (id, rubric_id, name, description, max_points, evidence_field, ordering)
     VALUES
       ('criterion_bls_01', 'rubric_bls_adult', 'Scene Safety + Response', 'Confirms scene safety and patient response', 10, NULL, 1),
       ('criterion_bls_02', 'rubric_bls_adult', 'Compression Rate', 'Maintains 100-120 compressions/min', 15, 'flightRecorder.compressionRate', 2),
       ('criterion_bls_03', 'rubric_bls_adult', 'Compression Depth', 'Achieves 50-60mm depth', 15, 'flightRecorder.compressionDepthMM', 3)
     ON CONFLICT (id) DO NOTHING`
  );

  console.log('✅ seed complete — 3 courses, 3 cohorts, 10 learners, 2 rubrics');
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✖ seed failed:', err.message);
  process.exit(1);
});
