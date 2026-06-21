import { query } from '../config/database.js';

function orgDTO(r) {
  return {
    id: r.id,
    name: r.name,
    accent: r.accent || null,
    regions: r.regions || [],
    tagline: r.tagline || null,
    updatedAt: r.updated_at,
  };
}

function ownsOrg(req) {
  return req.params.orgId === req.user.organisationId;
}

// GET /api/organisations/:orgId/profile
export async function getOrganisation(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot read another organisation', code: 'FORBIDDEN', status: 403 });
    const r = await query(`SELECT * FROM organisations WHERE id = $1`, [req.params.orgId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Organisation not found', code: 'NOT_FOUND', status: 404 });
    res.json(orgDTO(r.rows[0]));
  } catch (err) { next(err); }
}

// PUT /api/organisations/:orgId/profile — name, accent, regions, tagline.
export async function updateOrganisation(req, res, next) {
  try {
    if (!ownsOrg(req)) return res.status(403).json({ error: 'Cannot modify another organisation', code: 'FORBIDDEN', status: 403 });
    const cur = (await query(`SELECT * FROM organisations WHERE id = $1`, [req.params.orgId])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Organisation not found', code: 'NOT_FOUND', status: 404 });

    const b = req.body;
    if (b.accent && !/^#[0-9a-fA-F]{6}$/.test(b.accent)) {
      return res.status(400).json({ error: 'accent must be a 6-digit hex colour', code: 'VALIDATION_ERROR', status: 400 });
    }
    const regions = Array.isArray(b.regions) ? b.regions.map((s) => String(s).trim()).filter(Boolean) : cur.regions;
    const r = await query(
      `UPDATE organisations SET name = $1, accent = $2, regions = $3, tagline = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [b.name?.trim() || cur.name, b.accent ?? cur.accent, regions, b.tagline ?? cur.tagline, cur.id]
    );
    res.json(orgDTO(r.rows[0]));
  } catch (err) { next(err); }
}
