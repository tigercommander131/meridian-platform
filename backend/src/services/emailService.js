// CTOP messaging connector. Sends transactional email via Resend when configured
// (EMAIL_API_KEY + EMAIL_FROM); otherwise logs to the console so the invitation
// workflow still works end-to-end in dev and the status is tracked regardless.
//
// Node 20 has a global fetch — no SDK dependency.

import { config } from '../config/environment.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function emailEnabled() {
  return Boolean(config.emailApiKey && config.emailFrom);
}

// Returns { ok, id?, skipped?, error? } — never throws. Callers track invitation
// state independently of delivery success.
export async function sendEmail({ to, subject, html, text }) {
  if (!to) return { ok: false, error: 'no recipient' };

  if (!emailEnabled()) {
    console.log(`✉  [email:console] to=${to} subject="${subject}"`);
    if (text) console.log(text.split('\n').map((l) => '   ' + l).join('\n'));
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.emailFrom, to, subject, html, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`✖ email send failed (${res.status}):`, data?.message || data);
      return { ok: false, error: data?.message || `status ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('✖ email send error:', err.message);
    return { ok: false, error: err.message };
  }
}

// --- Templates -------------------------------------------------------------

const wrap = (body) => `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <div style="width:28px;height:28px;border-radius:8px;background:#0f766e;display:flex;align-items:center;justify-content:center">
        <span style="color:#fff;font-weight:700;font-size:13px">C</span>
      </div>
      <span style="font-weight:600;font-size:15px;color:#18181b">CTOP</span>
    </div>
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:28px">${body}</div>
    <p style="color:#a1a1aa;font-size:12px;margin-top:20px;text-align:center">Clinical Training Operations Platform</p>
  </div></body></html>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">${label}</a>`;

// Instructor invitation to staff a course.
export function invitationTemplate({ instructorName, courseName, roleLabel, startDate, message, acceptUrl, declineUrl }) {
  const when = startDate ? new Date(startDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'date to be confirmed';
  const subject = `Invitation: ${roleLabel} — ${courseName}`;
  const text = [
    `Hi ${instructorName},`,
    ``,
    `You're invited to staff "${courseName}" as ${roleLabel}.`,
    `Date: ${when}`,
    message ? `\nNote from the coordinator: ${message}` : '',
    ``,
    `Accept:  ${acceptUrl}`,
    `Decline: ${declineUrl}`,
  ].filter((l) => l !== null).join('\n');

  const html = wrap(`
    <p style="margin:0 0 4px;font-size:13px;color:#71717a">Staffing invitation</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${courseName}</h1>
    <p style="margin:0 0 6px;font-size:14px;color:#3f3f46">Hi ${instructorName}, you're invited as <strong>${roleLabel}</strong>.</p>
    <table style="margin:14px 0;font-size:14px;color:#3f3f46"><tr><td style="color:#71717a;padding:2px 16px 2px 0">Date</td><td>${when}</td></tr></table>
    ${message ? `<p style="margin:0 0 16px;padding:12px;background:#f4f5f7;border-radius:10px;font-size:13px;color:#3f3f46">${message}</p>` : ''}
    <div style="margin-top:20px;display:flex;gap:10px">${btn(acceptUrl, 'Accept')}&nbsp;&nbsp;<a href="${declineUrl}" style="display:inline-block;color:#71717a;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border:1px solid #e4e4e7;border-radius:10px">Decline</a></div>
  `);
  return { subject, text, html };
}

export function reminderTemplate(args) {
  const base = invitationTemplate(args);
  return { ...base, subject: `Reminder — ${base.subject}` };
}
