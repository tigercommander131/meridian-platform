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

  // Sample rubric (ALS VF Adult — Team Lead)
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

  // A few sample learners
  await query(
    `INSERT INTO learners (id, organisation_id, first_name, last_name, email, external_id)
     VALUES
       ('learner_001', 'parasol-emt', 'John', 'Smith', 'john.smith@hospital.edu.au', 'HR_2026_001'),
       ('learner_002', 'parasol-emt', 'Jane', 'Doe', 'jane.doe@hospital.edu.au', 'HR_2026_002')
     ON CONFLICT (organisation_id, email) DO NOTHING`
  );

  console.log('✅ seed complete');
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✖ seed failed:', err.message);
  process.exit(1);
});
