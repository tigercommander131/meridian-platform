import { invitationTemplate, reminderTemplate, emailEnabled } from '../emailService.js';

describe('emailService templates', () => {
  const args = {
    instructorName: 'Sarah',
    courseName: 'ALS2 — Sydney',
    roleLabel: 'Course Director',
    startDate: '2026-07-01T00:00:00.000Z',
    message: 'Hope you can make it',
    acceptUrl: 'https://app/invite/tok?r=accept',
    declineUrl: 'https://app/invite/tok?r=decline',
  };

  test('invitation includes role, course, and both action links', () => {
    const { subject, html, text } = invitationTemplate(args);
    expect(subject).toContain('Course Director');
    expect(subject).toContain('ALS2 — Sydney');
    expect(html).toContain(args.acceptUrl);
    expect(html).toContain(args.declineUrl);
    expect(text).toContain('Accept:');
    expect(text).toContain('Decline:');
    expect(html).toContain('Hope you can make it');
  });

  test('reminder reuses body but prefixes the subject', () => {
    const { subject } = reminderTemplate(args);
    expect(subject.startsWith('Reminder —')).toBe(true);
  });

  test('emailEnabled is false without provider config', () => {
    expect(emailEnabled()).toBe(false);
  });
});
