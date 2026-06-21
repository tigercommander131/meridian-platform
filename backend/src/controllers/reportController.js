import { query } from '../config/database.js';
import { complianceFor } from './staffingController.js';
import { analyze } from '../services/opsAdvisor.js';
import { generateReport, aiEnabled } from '../services/aiReport.js';

// GET /api/organisations/:orgId/ops-report
// Deterministic findings + suggestions, optionally narrated by Claude.
export async function opsReport(req, res, next) {
  try {
    if (req.params.orgId !== req.user.organisationId) {
      return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    }
    const orgRow = await query(`SELECT name FROM organisations WHERE id = $1`, [req.params.orgId]);
    const orgName = orgRow.rows[0]?.name || 'your organisation';

    const courses = await query(
      `SELECT c.*, ct.name AS course_type_name, ct.code AS course_type_code
       FROM courses c LEFT JOIN course_types ct ON ct.id = c.course_type_id
       WHERE c.organisation_id = $1 AND c.status NOT IN ('closed', 'cancelled')
       ORDER BY c.start_date NULLS LAST`,
      [req.params.orgId]
    );

    const list = [];
    for (const c of courses.rows) {
      const comp = await complianceFor(c);
      list.push({
        id: c.id,
        name: c.name,
        type: c.course_type_code || c.course_type_name || 'Course',
        region: c.region || 'Unassigned',
        startDate: c.start_date,
        status: comp.status,
        enrolled: c.confirmed_students,
        capacity: c.capacity || comp.capacity || comp.groups * 6,
        waitlist: c.waitlist_count || 0,
        groups: comp.groups,
        groupSize: 6,
        minStudents: comp.minStudents ?? comp.groups * 4,
        instructors: { assigned: comp.assigned.instructors, required: comp.required.instructors },
        cdOk: comp.required.course_director ? comp.assigned.course_director >= comp.required.course_director : true,
        mdOk: comp.required.medical_lead ? comp.assigned.medical_lead >= comp.required.medical_lead : true,
        als2: comp.required.medical_lead > 0,
      });
    }

    const analysis = analyze(list);
    const report = await generateReport(analysis, orgName);
    res.json({ orgName, aiEnabled: aiEnabled(), ...analysis, ...report });
  } catch (err) { next(err); }
}
