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
You are given pre-computed findings about courses that need attention. Your job: write a crisp operations briefing the coordinator can act on this morning.

Rules:
- Use ONLY the findings provided. Do not invent courses, numbers, names, or facts.
- Open with a one- or two-sentence executive summary of the overall state.
- Then a prioritised, numbered action list (highest impact first). Each item: the action to take, the course it concerns, and the one-line reason/impact.
- Be specific and quantitative; reference the real numbers from the findings.
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
        max_tokens: 1500,
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
