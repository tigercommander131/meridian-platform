// Steps for the first-run product tour (see Tour.jsx). Targetless steps render
// centered; steps with a `selector` spotlight that element in the sidebar.
export const TOUR_STEPS = [
  {
    tag: 'Welcome',
    title: 'Welcome to CTOP',
    body: 'A 30-second tour of how the operations workspace fits together. Skip anytime.',
  },
  {
    selector: '[data-tour="sidebar"]',
    tag: 'Workspace',
    title: 'Your ops workspace',
    body: 'Run accredited courses end to end — courses, instructors, students and the rules that govern them.',
  },
  {
    selector: '[data-tour="nav-accreditation"]',
    tag: 'Step 1',
    title: 'Set the rules',
    body: 'Add accreditation bodies (ARC, RA) and course types, each with a versioned staffing rule set.',
  },
  {
    selector: '[data-tour="nav-instructors"]',
    tag: 'Step 2',
    title: 'Build your crew',
    body: 'Add instructors with their credentials and eligible roles — your pool to staff courses from.',
  },
  {
    selector: '[data-tour="nav-courses"]',
    tag: 'Step 3',
    title: 'Run a course',
    body: 'Create a course, set student numbers, and assign staff — CTOP checks compliance live and tells you exactly what is missing.',
  },
  {
    tag: 'Done',
    title: "You're set",
    body: 'The Dashboard flags every course needing attention. Replay this tour any time via “Take a tour”.',
  },
];
