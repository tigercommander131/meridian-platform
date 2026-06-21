// AI operations report. Turns the deterministic advisor findings into a concise,
// prioritized narrative using Claude (Messages API via global fetch — no SDK
// dependency, mirroring emailService). Falls back to a deterministic summary
// when no CLAUDE_API_KEY is configured or the call fails.

import { config } from '../config/environment.js';
import { summaryText } from './opsAdvisor.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
// Only the highest-priority findings are sent to Claude — keeps cost flat and
// quality high regardless of how many courses are at risk.
const MAX_FINDINGS = 40;

export function aiEnabled() {
  return Boolean(config.claudeApiKey);
}

const SYSTEM = `You are the operations advisor for a clinical training provider that runs accredited resuscitation courses (ALS1 and ALS2).
You are given pre-computed findings about courses that need attention. Your job: write a SHORT operations briefing the coordinator can scan in 30 seconds.

Rules:
- Use ONLY the findings provided. Do not invent courses, numbers, names, or facts.
- Open with a 2-3 sentence executive summary of the overall state (counts + the single most urgent theme).
- Then group the issues into at most 4 themes, each a "## " heading followed by 1-2 lines. Do NOT prefix headings with category labels like "COMPLIANCE", "STAFFING", or "VIABILITY" — use plain descriptive titles (e.g. "## Course Director gaps").
- Within a theme, summarise (e.g. "9 ALS2 courses have no Course Director — Sydney ×3, Brisbane, Geelong…"). Do not list every course one by one; the coordinator sees the full itemised list elsewhere.
- Be specific and quantitative; reference real numbers. Keep the whole briefing under ~200 words.
- Plain markdown. No preamble, no sign-off, no headings deeper than "##". Respond with the report only.`;

export async function generateReport(analysis, orgName = 'your organisation') {
  const fallback = { narrative: summaryText(analysis, orgName), source: 'deterministic', aiEnabled: aiEnabled() };
  if (!aiEnabled()) return fallback;

  const sent = analysis.findings.slice(0, MAX_FINDINGS);
  const omitted = analysis.findings.length - sent.length;
  const userContent =
    `Organisation: ${orgName}\n\n` +
    `Portfolio stats: ${JSON.stringify(analysis.stats)}\n\n` +
    `Top findings (already prioritised by severity${omitted > 0 ? `; ${omitted} lower-priority findings omitted` : ''}):\n${JSON.stringify(sent, null, 2)}\n\n` +
    `Write the operations briefing.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.claudeModel,
        max_tokens: 900,
        system: SYSTEM,
        output_config: { effort: 'medium' },
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`✖ AI report failed (${res.status}):`, data?.error?.message || data);
      return { ...fallback, source: 'fallback_error' };
    }
    if (data.stop_reason === 'refusal') return { ...fallback, source: 'fallback_refusal' };
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) return { ...fallback, source: 'fallback_empty' };
    return { narrative: text, source: 'ai', aiEnabled: true, model: data.model };
  } catch (err) {
    console.error('✖ AI report error:', err.message);
    return { ...fallback, source: 'fallback_error' };
  }
}
