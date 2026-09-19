// Writes data/history.json: three weeks of approved check ins for Elena, Priya and Jonas,
// 31 August to 17 September 2026. No dependencies. Run with: node data/make_history.mjs
// A fixed seed makes the output identical on every run.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const people = JSON.parse(readFileSync(join(here, 'people.json'), 'utf8'));
const splits = JSON.parse(readFileSync(join(here, 'expected_splits.json'), 'utf8'));

const SEED = 20260918;
const WOBBLE_POINTS = 3; // each topic's share moves up or down by up to this many points per day
const REPORTING = 'Manual status reporting';
const TIMESHEETS = 'Timesheet reconciliation';

// Small, fast pseudo random generator (mulberry32) so the output never changes between runs.
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = makeRandom(SEED);
const pick = (list) => list[Math.floor(random() * list.length)];

// Working days, Monday 31 August to Thursday 17 September 2026.
const days = [];
for (let d = new Date(Date.UTC(2026, 7, 31)); d <= new Date(Date.UTC(2026, 8, 17)); d.setUTCDate(d.getUTCDate() + 1)) {
  const weekday = d.getUTCDay();
  if (weekday >= 1 && weekday <= 5) days.push({ day: d.toISOString().slice(0, 10), weekday });
}

// Outside role work per person and weekday (1 is Monday), in minutes.
const outsideRole = {
  elena: {
    1: [[REPORTING, 60, 'Started the weekly status pack for the three client accounts from the project tracker export.'],
        [TIMESHEETS, 45, 'Matched team hours against the resourcing sheet for all three accounts.']],
    5: [[REPORTING, 150, 'Copied figures from the project tracker into the status pack slides, formatted them and emailed eight client contacts.']],
  },
  priya: {
    1: [[TIMESHEETS, 45, 'Checked team hours for Ashvale and Kestrel Point against the resourcing sheet.']],
    5: [[REPORTING, 90, 'Pulled Ashvale and Kestrel Point figures into the status pack and checked them with Elena.']],
  },
  jonas: {
    1: [[REPORTING, 35, 'Exported the project tracker and matched hours against the resourcing sheet for the status pack.'],
        [TIMESHEETS, 45, 'Reconciled analyst hours in the resourcing sheet with the tracker.']],
    2: [[REPORTING, 35, 'Chased missing hours from the tracker export for the status pack.']],
    3: [[REPORTING, 35, 'Updated the budget sheet by hand so spend figures agree with the tracker.']],
    4: [[REPORTING, 35, 'Rechecked status pack figures after late changes in the tracker.']],
    5: [[REPORTING, 40, 'Sent final hours and spend figures to Elena for the Friday status pack.']],
  },
};

// Plain evidence lines per topic, so each day reads like a real check in.
const evidence = {
  'Client delivery and workshops': [
    'Calendar: Kestrel Point Logistics working session on the returns process.',
    'Calendar: Ashvale Housing Trust repairs backlog session; confirmed in the interview.',
    'Calendar: Northmere Foods supply planning review; call transcript on file.',
    'Interview: worked on Northmere Foods recommendations between meetings.',
  ],
  'Client relationships': [
    'Calendar: Northmere Foods weekly client call with Sophie Lindqvist.',
    'Calendar: call with Aisha Delaney at Ashvale Housing Trust.',
    'Interview: follow up calls with Kestrel Point Logistics after the planning meeting.',
  ],
  'Proposals and business development': [
    'Calendar: Ashvale Housing Trust phase two proposal with Tomas Berg.',
    'Interview: gathered evidence from live work for the Ashvale proposal.',
  ],
  'Coaching juniors': [
    'Calendar: coaching session with Priya Nair.',
    'Calendar: coaching session with Jonas Weber.',
    'Interview: went through the Kestrel Point workshop materials with Priya Nair.',
  ],
  'Internal meetings and administration': [
    'Calendar: Client Delivery stand up and weekly review.',
    'Calendar: Client Delivery team meeting.',
    'Interview: planning and engagement records.',
  ],
  'Client research and analysis': [
    'Interview: interviewed Ashvale repairs staff about the current process.',
    'Interview: studied Kestrel Point returns data from the warehouse.',
    'Calendar: site visit to the Kestrel Point warehouse.',
  ],
  'Workshop preparation and support': [
    'Calendar: Kestrel Point workshop materials with Elena Ruiz.',
    'Interview: built the returns process map for the Kestrel Point workshop.',
    'Calendar: Ashvale working session; captured what was agreed.',
  ],
  'Drafting recommendations': [
    'Interview: drafted the Ashvale repairs recommendations for Elena to review.',
    'Calendar: Ashvale draft recommendations with Elena Ruiz.',
  ],
  'Learning and development': [
    'Calendar: coaching session with Elena Ruiz.',
    'Calendar: facilitation training session.',
  ],
  'Data analysis and modelling': [
    'Interview: built the autumn demand forecast for Northmere Foods.',
    'Interview: analysed the Ashvale repairs backlog by trade and age.',
    'Calendar: forecast working session.',
  ],
  'Supporting consultants with data': [
    'Interview: answered data questions from Elena and Priya.',
    'Interview: checked figures in the Ashvale draft recommendations.',
  ],
  'Client presentations of findings': [
    'Calendar: Northmere Foods demand forecast review with Daniel Achterberg.',
    'Calendar: presented backlog findings to Ashvale Housing Trust.',
  ],
  'Documenting models': [
    'Interview: wrote up how the Northmere forecast model works.',
    'Interview: documented the Ashvale backlog analysis.',
  ],
};

const round5 = (n) => Math.round(n / 5) * 5;

function hoursText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hPart = h === 0 ? '' : h === 1 ? '1 hour' : `${h} hours`;
  const mPart = m === 0 ? '' : `${m} minutes`;
  return [hPart, mPart].filter(Boolean).join(' ');
}

const checkIns = [];
for (const { day, weekday } of days) {
  for (const personKey of ['elena', 'priya', 'jonas']) {
    const person = people.find((p) => p.key === personKey);
    const total = person.working_minutes_per_day;
    const topics = splits[person.role_key];

    const outside = (outsideRole[personKey][weekday] || []).map(([label, minutes, note]) => ({
      topic_name: null, label, in_role: false, minutes, evidence: note,
    }));
    const inRoleMinutes = total - outside.reduce((s, a) => s + a.minutes, 0);

    // Share the in role minutes across topics by expected percent plus a small wobble.
    const weights = topics.map((t) => Math.max(1, t.expected_percent + (random() * 2 - 1) * WOBBLE_POINTS));
    const weightSum = weights.reduce((s, w) => s + w, 0);
    const inRole = topics.map((t, i) => ({
      topic_name: t.name, label: t.name, in_role: true,
      minutes: round5((inRoleMinutes * weights[i]) / weightSum),
      evidence: pick(evidence[t.name]),
    }));
    // Put any rounding difference on the largest topic so the day adds up exactly.
    const largest = inRole.reduce((a, b) => (b.minutes > a.minutes ? b : a));
    largest.minutes += inRoleMinutes - inRole.reduce((s, a) => s + a.minutes, 0);

    const allocations = [...inRole, ...outside].filter((a) => a.minutes > 0);

    // Percents to one decimal place, with the largest row adjusted so they add up to 100.0.
    for (const a of allocations) a.percent = Math.round((a.minutes / total) * 1000) / 10;
    const tenthsGap = 1000 - allocations.reduce((s, a) => s + Math.round(a.percent * 10), 0);
    const biggest = allocations.reduce((a, b) => (b.minutes > a.minutes ? b : a));
    biggest.percent = Math.round(biggest.percent * 10 + tenthsGap) / 10;

    for (const a of allocations) a.employee_adjusted = a.in_role && random() < 0.04;

    const firstName = person.full_name.split(' ')[0];
    const top = inRole.reduce((a, b) => (b.minutes > a.minutes ? b : a));
    const outsideTotal = outside.reduce((s, a) => s + a.minutes, 0);
    const summary_text = [
      `${firstName}'s largest share of the day went to ${top.topic_name.toLowerCase()}, at ${hoursText(top.minutes)}.`,
      outsideTotal === 0
        ? 'No time went to work outside the role.'
        : `${hoursText(outsideTotal)} went to work outside the role: ${outside.map((a) => a.label.toLowerCase()).join(' and ')}.`,
    ].join(' ');

    checkIns.push({
      person_key: personKey,
      day,
      status: 'approved',
      approved_by_key: 'tomas',
      summary_text,
      allocations: allocations.map(({ topic_name, label, in_role, minutes, percent, evidence: ev, employee_adjusted }) => ({
        topic_name, label, in_role, minutes, percent, evidence: ev, employee_adjusted,
      })),
    });
  }
}

writeFileSync(join(here, 'history.json'), JSON.stringify({ check_ins: checkIns }, null, 2) + '\n');
console.log(`Wrote ${checkIns.length} check ins to data/history.json`);
