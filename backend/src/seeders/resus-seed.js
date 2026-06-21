import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import pgformat from 'pg-format';
import { query, getPool } from '../config/database.js';
import { evaluate, ALS1_RULES, ALS2_RULES } from '../services/staffingEngine.js';

// Imports the 500-course resuscitation operations dataset into a dedicated
// "Resuscitation Ops" org. Staffing is stored as counts/flags (per the sheet);
// CTOP's own engine computes each course's status from the PDF rules.
// Run: `npm run seed:resus` (idempotent).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORG = 'resus';
const ACCRED = 'resus_accred';
const T_ALS1 = 'resus_ctype_als1';
const T_ALS2 = 'resus_ctype_als2';
const CENTRES = ['Sydney', 'Wollongong', 'Newcastle', 'Canberra', 'Brisbane', 'Sunshine Coast', 'Gold Coast', 'Melbourne', 'Geelong', 'Adelaide'];

async function seed() {
  console.log('🌱 importing resuscitation operations dataset...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'resus-courses.json'), 'utf8'));
  console.log(`   ${data.length} courses to import`);

  await query(
    `INSERT INTO organisations (id, name, accent, regions, tagline) VALUES ($1, 'Resuscitation Ops', '#0e7490', $2, 'ALS course operations — 500 live courses.')
     ON CONFLICT (id) DO UPDATE SET accent = EXCLUDED.accent, regions = EXCLUDED.regions, tagline = EXCLUDED.tagline`,
    [ORG, CENTRES]
  );

  const pw = await bcrypt.hash('password', 10);
  await query(
    `INSERT INTO users (id, organisation_id, email, password_hash, first_name, last_name, roles)
     VALUES ('user_resus_admin', $1, 'admin@resus.example', $2, 'Ops', 'Control', $3)
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
       ('resus_rule_als1', $1, 1, $3),
       ('resus_rule_als2', $2, 1, $4)
     ON CONFLICT (id) DO UPDATE SET rules = EXCLUDED.rules`,
    [T_ALS1, T_ALS2, JSON.stringify(ALS1_RULES), JSON.stringify(ALS2_RULES)]
  );

  const rows = data.map((c) => {
    const als2 = c.type === 'ALS 2';
    const cdEff = Boolean(c.cd) && Boolean(c.cdQualified);
    const mdEff = Boolean(c.md) && Boolean(c.mdDoctor);
    const status = evaluate({
      ruleSet: als2 ? ALS2_RULES : ALS1_RULES, groups: c.groups, enrolled: c.enrolled,
      instructors: c.instructors, courseDirector: cdEff, medicalDirector: mdEff,
    }).status;
    return [
      'resus_' + String(c.ref).replace(/-/g, '_'), ORG, `${c.type} — ${c.centre}`,
      ACCRED, als2 ? T_ALS2 : T_ALS1, c.centre,
      c.capacity, c.enrolled, c.waitlist ?? 0, status,
      c.start, c.end, c.groups, c.durationDays, c.ref, true,
      c.instructors, als2 ? Boolean(c.cd) : null, als2 ? Boolean(c.md) : null,
      als2 ? Boolean(c.cdQualified) : null, als2 ? Boolean(c.mdDoctor) : null,
    ];
  });

  const cols = '(id, organisation_id, name, accreditation_org_id, course_type_id, region, capacity, confirmed_students, waitlist_count, status, start_date, end_date, groups, duration_days, external_ref, imported, instructors_assigned, course_director_assigned, medical_director_assigned, cd_qualified, md_doctor)';
  const update = 'region=EXCLUDED.region, capacity=EXCLUDED.capacity, confirmed_students=EXCLUDED.confirmed_students, waitlist_count=EXCLUDED.waitlist_count, status=EXCLUDED.status, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, groups=EXCLUDED.groups, duration_days=EXCLUDED.duration_days, imported=true, instructors_assigned=EXCLUDED.instructors_assigned, course_director_assigned=EXCLUDED.course_director_assigned, medical_director_assigned=EXCLUDED.medical_director_assigned, cd_qualified=EXCLUDED.cd_qualified, md_doctor=EXCLUDED.md_doctor';

  let done = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await query(pgformat(`INSERT INTO courses ${cols} VALUES %L ON CONFLICT (id) DO UPDATE SET ${update}`, chunk));
    done += chunk.length;
    console.log(`   inserted ${done}/${rows.length}`);
  }

  const byStatus = {};
  for (const r of rows) { byStatus[r[9]] = (byStatus[r[9]] || 0) + 1; }
  console.log('✅ resus import complete — org "resus", login admin@resus.example / password');
  console.log('   status mix:', JSON.stringify(byStatus));
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => { console.error('✖ resus import failed:', err.message); process.exit(1); });
