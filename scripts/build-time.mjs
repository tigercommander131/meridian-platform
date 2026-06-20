#!/usr/bin/env node
// Build-time tracker — estimates how long this project has actually taken,
// derived from git commit timestamps (no manual logging needed).
//
//   node scripts/build-time.mjs          # print a report
//   node scripts/build-time.mjs --md     # also (re)write TIME-LOG.md
//
// "Active time" = sum of gaps between consecutive commits, but any gap longer
// than IDLE_CAP minutes is treated as a break and counted as only LEAD minutes
// (you were away, not coding). LEAD minutes are also added before the very first
// commit, since work happens before the first save.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const IDLE_CAP = 60; // minutes — a gap bigger than this is a break
const LEAD = 30;     // minutes of work assumed before a commit after a break

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
}

// Unix timestamps (seconds), oldest first.
const stamps = git('log --format=%at')
  .split('\n')
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);

if (stamps.length === 0) {
  console.error('No commits found.');
  process.exit(1);
}

let activeMin = LEAD; // work before the first commit
for (let i = 1; i < stamps.length; i++) {
  const gapMin = (stamps[i] - stamps[i - 1]) / 60;
  activeMin += gapMin > IDLE_CAP ? LEAD : gapMin;
}

const first = new Date(stamps[0] * 1000);
const last = new Date(stamps[stamps.length - 1] * 1000);
const days = new Set(git('log --format=%ad --date=short').split('\n')).size;
const spanH = (stamps[stamps.length - 1] - stamps[0]) / 3600;
const activeH = activeMin / 60;
const fmt = (d) => d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const report = [
  'PARASOL EMS — build time',
  '─'.repeat(32),
  `First commit : ${fmt(first)}`,
  `Last commit  : ${fmt(last)}`,
  `Commits      : ${stamps.length}`,
  `Active days  : ${days}`,
  `Calendar span: ${spanH.toFixed(1)} h`,
  `Est. active  : ${activeH.toFixed(1)} h  (gaps > ${IDLE_CAP}m counted as ${LEAD}m)`,
].join('\n');

console.log(report);

if (process.argv.includes('--md')) {
  const md = `# Build Time Log\n\n_Auto-generated from git — run \`node scripts/build-time.mjs --md\` to refresh._\n\n\`\`\`\n${report}\n\`\`\`\n`;
  writeFileSync(new URL('../TIME-LOG.md', import.meta.url), md);
  console.log('\n→ wrote TIME-LOG.md');
}
