// Puts the live database back to the start of the demo story.
//
//   node --env-file=frontend/.env.local scripts/reset_demo.mjs
//   node --env-file=frontend/.env.local scripts/reset_demo.mjs --clear-candidates
//
// Safe to run as many times as you like. It reads the address and the service
// key from the environment and never prints them.
//
// What it does:
//   1. Elena's check in for the demo day goes back to "invited", with its
//      interview, its allocations and the activities Scout worked out deleted.
//      Her calendar entries and recorded calls stay: those are what Scout is
//      told, not what it concluded.
//   2. The three weeks of approved history are left alone.
//   3. Every role goes back to a proposed split, and each topic's expected
//      share goes back to what the AI first proposed.
//   4. Approvals are deleted. Suggestions are kept and set back to "proposed",
//      with any draft link cleared, unless --clear-candidates is given, in
//      which case they are deleted so the review can be shown from empty.
//
// What it does NOT do: it never touches make.com. Draft scenarios made by
// earlier runs stay in the folder "Workflow Scout drafts". Delete those by
// hand if you want a clean drafts folder.

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoDay = process.env.NEXT_PUBLIC_DEMO_DAY || '2026-09-18';
const clearCandidates = process.argv.includes('--clear-candidates');

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. Run this with --env-file=frontend/.env.local');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

/** One call to the database. Returns the rows, and stops the script on any refusal. */
async function call(what, path, { method = 'GET', body, count = false } = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...headers, Prefer: count ? 'return=representation' : 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    // The message can name a column or a constraint, never a key.
    console.error(`Could not ${what}: the database replied ${response.status}. ${text.slice(0, 200)}`);
    process.exit(1);
  }
  try {
    return JSON.parse(text || '[]');
  } catch {
    return [];
  }
}

const say = (line) => console.log(line);

// 1. The people and the demo day -------------------------------------------
const people = await call('read the people', 'people?select=id,full_name,company_id');
const elena = people.find((p) => p.full_name === 'Elena Ruiz');
if (!elena) {
  console.error('Elena Ruiz is not in the database. Run the seed script first.');
  process.exit(1);
}

const checkIns = await call('read the demo day', `check_ins?select=id,status&person_id=eq.${elena.id}&day=eq.${demoDay}`);

let turnsDeleted = 0;
let allocationsDeleted = 0;
let activitiesDeleted = 0;

for (const checkIn of checkIns) {
  turnsDeleted += (await call('delete the interview', `interview_turns?check_in_id=eq.${checkIn.id}`, { method: 'DELETE' })).length;
  allocationsDeleted += (await call('delete the allocations', `day_allocations?check_in_id=eq.${checkIn.id}`, { method: 'DELETE' })).length;
  await call('put the check in back to invited', `check_ins?id=eq.${checkIn.id}`, {
    method: 'PATCH',
    body: {
      status: 'invited',
      submitted_at: null,
      approved_by: null,
      approved_at: null,
      manager_comment: null,
      summary_text: null,
    },
  });
}

activitiesDeleted = (
  await call('delete the interview activities', `activities?person_id=eq.${elena.id}&day=eq.${demoDay}&source=eq.interview`, {
    method: 'DELETE',
  })
).length;

const calendarLeft = (await call('count the calendar entries', `activities?select=id&person_id=eq.${elena.id}&day=eq.${demoDay}&source=eq.calendar`)).length;
const callsLeft = (await call('count the recorded calls', `activities?select=id&person_id=eq.${elena.id}&day=eq.${demoDay}&source=eq.transcript`)).length;

// 2. The roles and their splits ---------------------------------------------
const roles = await call('put the roles back to proposed', 'roles?id=not.is.null', {
  method: 'PATCH',
  body: { split_status: 'proposed', split_approved_by: null, split_approved_at: null },
});

const topics = await call('read the topics', 'topics?select=id,expected_percent,proposed_percent');
let topicsChanged = 0;
for (const topic of topics) {
  if (Number(topic.expected_percent) === Number(topic.proposed_percent)) continue;
  await call('put a topic back to its proposed share', `topics?id=eq.${topic.id}`, {
    method: 'PATCH',
    body: { expected_percent: topic.proposed_percent },
  });
  topicsChanged += 1;
}

// 3. Approvals and suggestions ----------------------------------------------
const approvalsDeleted = (await call('delete the approvals', 'approvals?id=not.is.null', { method: 'DELETE' })).length;

let candidatesDeleted = 0;
let candidatesReset = 0;
if (clearCandidates) {
  candidatesDeleted = (await call('delete the suggestions', 'candidates?id=not.is.null', { method: 'DELETE' })).length;
} else {
  candidatesReset = (
    await call('put the suggestions back to proposed', 'candidates?id=not.is.null', {
      method: 'PATCH',
      body: { status: 'proposed', make_scenario_id: null, make_scenario_url: null },
    })
  ).length;
}

// 4. What is left ------------------------------------------------------------
const approvedDays = (await call('count the approved history', 'check_ins?select=id&status=eq.approved')).length;

say('The demo is back at the start.');
say('');
say(`Elena's day (${demoDay}): ${checkIns.length ? 'set back to invited' : 'no check in found, nothing to reset'}.`);
say(`  interview turns deleted: ${turnsDeleted}`);
say(`  day allocations deleted: ${allocationsDeleted}`);
say(`  activities Scout worked out deleted: ${activitiesDeleted}`);
say(`  calendar entries kept: ${calendarLeft}, recorded calls kept: ${callsLeft}`);
say(`Roles set back to a proposed split: ${roles.length}`);
say(`Topics put back to their proposed share: ${topicsChanged}`);
say(`Approvals deleted: ${approvalsDeleted}`);
say(clearCandidates ? `Suggestions deleted: ${candidatesDeleted}` : `Suggestions set back to proposed: ${candidatesReset}`);
say(`Approved days of history left untouched: ${approvedDays}`);
say('');
say('Nothing in make.com was touched. Draft scenarios from earlier runs are still');
say('in the folder "Workflow Scout drafts". Delete those by hand if you want the');
say('folder empty for the next round.');
