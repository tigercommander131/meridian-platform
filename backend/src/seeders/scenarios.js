import { query, getPool } from '../config/database.js';

// A starter library of simulation scenarios, each with its own tailored rubric.
// Seeded into EVERY organisation so the session "Scenario" picker has options.
// Rubrics use role = NULL so they apply to any participant role.
// Run: `npm run seed:scenarios`  (idempotent).

const SCENARIOS = [
  // --- Adult Cardiac ---
  { id: 'scenario_vf_adult', cat: 'Adult Cardiac', name: 'VF/VT Cardiac Arrest — Adult', criteria: [
    ['Scene & high-quality CPR', 'Confirms arrest; compressions 50-60mm at 100-120/min', 25, 'flightRecorder.compressionDepthMM'],
    ['Rhythm recognition', 'Correctly identifies VF/VT', 15, null],
    ['Defibrillation', 'Safe, timely shocks at correct energy', 25, 'flightRecorder.timeToFirstShock'],
    ['ALS drugs', 'Adrenaline / amiodarone correct dose and timing', 20, null],
    ['Team leadership', 'Clear roles and closed-loop communication', 15, null],
  ] },
  { id: 'scenario_pea_adult', cat: 'Adult Cardiac', name: 'PEA / Asystole — Adult', criteria: [
    ['High-quality CPR', 'Minimises interruptions to compressions', 25, null],
    ['Non-shockable algorithm', 'Follows correct non-shockable path', 20, null],
    ['Reversible causes (4Hs/4Ts)', 'Actively seeks and treats causes', 25, null],
    ['Adrenaline timing', 'Every 3-5 minutes', 15, null],
    ['Team leadership', 'Coordinated resuscitation', 15, null],
  ] },
  { id: 'scenario_brady_adult', cat: 'Adult Cardiac', name: 'Symptomatic Bradycardia — Adult', criteria: [
    ['Assessment & monitoring', 'ABCDE; identifies instability', 20, null],
    ['Atropine', 'Correct dose and timing', 20, null],
    ['Pacing / escalation', 'Transcutaneous pacing when indicated', 25, null],
    ['Identify cause', 'Considers reversible causes', 20, null],
    ['Communication', 'Clear escalation and handover', 15, null],
  ] },
  // --- Trauma ---
  { id: 'scenario_trauma_rta', cat: 'Trauma', name: 'Major Trauma — Road Traffic Accident', criteria: [
    ['Primary survey (cABCDE)', 'Systematic sequence', 25, null],
    ['Catastrophic haemorrhage', 'Controls bleeding early', 25, null],
    ['Airway + C-spine', 'Secures airway, protects spine', 20, null],
    ['Circulation & access', 'IV/IO access, fluids or blood', 15, null],
    ['Team & handover', 'Structured ATMIST handover', 15, null],
  ] },
  { id: 'scenario_trauma_chest', cat: 'Trauma', name: 'Penetrating Chest Trauma', criteria: [
    ['Primary survey', 'ABCDE priority', 20, null],
    ['Tension pneumothorax', 'Recognises and decompresses', 30, null],
    ['Haemorrhage control', 'Manages bleeding', 20, null],
    ['Oxygenation', 'Effective ventilation', 15, null],
    ['Escalation', 'Timely surgical referral', 15, null],
  ] },
  // --- Paediatric ---
  { id: 'scenario_paed_anaphylaxis', cat: 'Paediatric', name: 'Paediatric Anaphylaxis', criteria: [
    ['Recognition', 'Identifies anaphylaxis quickly', 20, null],
    ['IM adrenaline', 'Correct weight-based dose', 30, null],
    ['Airway & breathing', 'Oxygen and airway support', 20, null],
    ['Fluids', 'Weight-based bolus', 15, null],
    ['Family communication', 'Clear and calm', 15, null],
  ] },
  { id: 'scenario_paed_resp', cat: 'Paediatric', name: 'Paediatric Respiratory Distress', criteria: [
    ['Assessment triangle', 'Appearance / work of breathing / circulation', 20, null],
    ['Oxygen & positioning', 'Appropriate support', 20, null],
    ['Treatment', 'Correct bronchodilators / therapy', 25, null],
    ['Escalation', 'Recognises deterioration', 20, null],
    ['Communication', 'Family and team', 15, null],
  ] },
  { id: 'scenario_neonatal', cat: 'Paediatric', name: 'Neonatal Resuscitation', criteria: [
    ['Initial steps', 'Warm, dry, stimulate', 20, null],
    ['Inflation breaths', 'Effective lung inflation', 30, null],
    ['Chest compressions', '3:1 ratio when indicated', 20, null],
    ['Reassessment', 'Heart-rate guided', 15, null],
    ['Team & records', 'Clear timeline', 15, null],
  ] },
  // --- Medical ---
  { id: 'scenario_sepsis', cat: 'Medical', name: 'Sepsis — Adult', criteria: [
    ['Recognition', 'Identifies sepsis / red flags', 20, null],
    ['Sepsis Six', 'Delivers the bundle within the hour', 30, null],
    ['Fluids & oxygen', 'Appropriate resuscitation', 20, null],
    ['Antibiotics', 'Timely broad-spectrum cover', 15, null],
    ['Escalation', 'Senior / critical care input', 15, null],
  ] },
];

async function seed() {
  console.log('🌱 seeding scenario library...');
  const orgs = await query(`SELECT id FROM organisations ORDER BY id`);
  if (orgs.rowCount === 0) {
    console.log('No organisations found — seed an org first.');
    await getPool().end();
    process.exit(0);
  }

  let count = 0;
  for (const org of orgs.rows) {
    for (const sc of SCENARIOS) {
      const rubricId = `rubric_${org.id}_${sc.id}`;
      await query(
        `INSERT INTO rubrics (id, organisation_id, name, scenario_id, role, category, version, max_score)
         VALUES ($1, $2, $3, $4, NULL, $5, '1.0', 100)
         ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name`,
        [rubricId, org.id, sc.name, sc.id, sc.cat]
      );
      let order = 1;
      for (const [name, desc, pts, evidence] of sc.criteria) {
        await query(
          `INSERT INTO rubric_criteria (id, rubric_id, name, description, max_points, evidence_field, ordering)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [`crit_${org.id}_${sc.id}_${order}`, rubricId, name, desc, pts, evidence, order]
        );
        order++;
      }
      count++;
    }
  }

  console.log(`✅ ${SCENARIOS.length} scenarios seeded into ${orgs.rowCount} org(s) (${count} rubrics total)`);
  await getPool().end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✖ scenario seed failed:', err.message);
  process.exit(1);
});
