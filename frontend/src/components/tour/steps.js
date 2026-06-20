// Steps for the first-run product tour (see Tour.jsx). Targetless steps render
// centered; steps with a `selector` spotlight that element in the sidebar.
export const TOUR_STEPS = [
  {
    tag: 'Welcome',
    title: 'Welcome to Indigo Learning',
    body: 'A 30-second tour of how the workspace fits together. Skip anytime.',
  },
  {
    selector: '[data-tour="sidebar"]',
    tag: 'Workspace',
    title: 'Your workspace',
    body: 'Everything lives here — students, courses, cohorts, sessions and reports.',
  },
  {
    selector: '[data-tour="nav-courses"]',
    tag: 'Step 1',
    title: 'Start with a course',
    body: 'Create a course (e.g. ALS), then group learners into cohorts to run it.',
  },
  {
    selector: '[data-tour="nav-students"]',
    tag: 'Step 2',
    title: 'Add your learners',
    body: 'Enrol students one by one, or bulk-import from CSV.',
  },
  {
    selector: '[data-tour="nav-sessions"]',
    tag: 'Step 3',
    title: 'Run a session',
    body: 'Check learners in (QR or manual), assign roles, and score against the rubric — evidence auto-fills from the simulator.',
  },
  {
    selector: '[data-tour="nav-reports"]',
    tag: 'Step 4',
    title: 'Release & report',
    body: 'Approve and release scores; they become candidate reports and CSV/PDF exports.',
  },
  {
    tag: 'Done',
    title: "You're all set",
    body: 'Create your first course to begin. Replay this tour any time via “Take a tour” in the sidebar.',
  },
];
