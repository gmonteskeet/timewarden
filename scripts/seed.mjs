#!/usr/bin/env node
//
// Workflow Scout seed script.
//
// Loads the made up Brightline Advisory data into Supabase. Safe to run as
// often as you like: everything is an upsert on a natural key, so a second run
// changes no row counts.
//
//   node scripts/seed.mjs                     the normal run
//   node scripts/seed.mjs --with-splits       also load the expected splits
//   node scripts/seed.mjs --with-calendar     also load Elena's calendar week
//
// The two flags are fallbacks, not the normal path. Topics are meant to come
// from the role documents through scenario one, and calendar activities from
// Google Calendar through the morning run. Use the flags only if one of those
// connections will not behave, and say so in the README.
//
// It needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. If they are not in the
// environment it reads frontend/.env.local.

import { createClient } from '@supabase/supabase-js';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

const args = new Set(process.argv.slice(2));
const withSplits = args.has('--with-splits');
const withCalendar = args.has('--with-calendar');

// Transcripts carry no owner in their header, and every one of them is Elena's.
// A `person_key:` line in the header wins if a future file has one.
const DEFAULT_TRANSCRIPT_OWNER = 'elena';

// ---------------------------------------------------------------- helpers ---

function readEnvLocal() {
  const file = path.join(ROOT, 'frontend', '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name]) continue;
    process.env[name] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function stop(message) {
  console.error(`\nSeed stopped: ${message}\n`);
  process.exit(1);
}

function check({ error }, what) {
  if (error) stop(`${what} failed. ${error.message}`);
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(DATA, name), 'utf8'));
}

// A role document is one Markdown file. The first heading is the role title,
// everything after it is the job description, and the numbered list under
// "Performance measures" becomes the performance measures we send to Claude.
function parseRoleDocument(fileName, text) {
  const lines = text.split('\n');
  const headingAt = lines.findIndex((line) => line.startsWith('# '));
  if (headingAt === -1) stop(`${fileName} has no title heading.`);

  const title = lines[headingAt].replace(/^#\s+/, '').trim();
  const body = lines.slice(headingAt + 1).join('\n').trim();

  const kpis = [];
  let inMeasures = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      inMeasures = /performance measures/i.test(line);
      continue;
    }
    if (!inMeasures) continue;
    const item = line.match(/^\s*\d+\.\s+(.*\S)\s*$/);
    if (item) kpis.push(item[1]);
  }
  if (kpis.length === 0) {
    console.warn(`  Careful: no performance measures found in ${fileName}.`);
  }

  return { role_key: path.basename(fileName, '.md'), title, job_description: body, kpis };
}

// A transcript is a small header block, then a line of three dashes, then the
// call itself.
function parseTranscript(fileName, text) {
  const [rawHeader, ...rest] = text.split(/^---\s*$/m);
  if (rest.length === 0) stop(`${fileName} has no --- line between the header and the call.`);

  const header = {};
  for (const line of rawHeader.split('\n')) {
    const match = line.match(/^\s*([a-z_]+)\s*:\s*(.*\S)\s*$/);
    if (match) header[match[1]] = match[2];
  }
  for (const required of ['title', 'occurred_at', 'minutes']) {
    if (!header[required]) stop(`${fileName} is missing "${required}" in its header.`);
  }

  return {
    person_key: header.person_key || DEFAULT_TRANSCRIPT_OWNER,
    title: header.title,
    occurred_at: header.occurred_at,
    minutes: Number(header.minutes),
    in_calendar: header.in_calendar === 'true',
    body: rest.join('---').trim(),
  };
}

const atMadrid = (day, time) => `${day}T${time}:00+02:00`;

// ------------------------------------------------------------------- main ---

readEnvLocal();
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  stop(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set.\n' +
      '  Put them in frontend/.env.local, or in front of the command:\n' +
      '  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs'
  );
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

console.log(`\nSeeding ${url}`);
if (withSplits) console.log('  with the expected splits, because reading the role documents live is cut');
if (withCalendar) console.log('  with the calendar week, because the Google Calendar connection is not behaving');

// 1. The company ------------------------------------------------------------
const companyData = await readJson('company.json');
const company = await db
  .from('companies')
  .upsert({ name: companyData.name }, { onConflict: 'name' })
  .select('id, name')
  .single();
check(company, 'Writing the company');
const companyId = company.data.id;
console.log(`\n  Company: ${company.data.name}`);

// 2. Roles, read from the role documents ------------------------------------
const roleFiles = (await readdir(path.join(DATA, 'role_documents')))
  .filter((name) => name.endsWith('.md'))
  .sort();

const roleRows = [];
for (const fileName of roleFiles) {
  const text = await readFile(path.join(DATA, 'role_documents', fileName), 'utf8');
  roleRows.push(parseRoleDocument(fileName, text));
}

const rolesWritten = await db
  .from('roles')
  .upsert(
    roleRows.map((role) => ({
      company_id: companyId,
      title: role.title,
      document_name: `${role.role_key}.md`,
      job_description: role.job_description,
      kpis: role.kpis,
    })),
    { onConflict: 'company_id,title' }
  )
  .select('id, title');
check(rolesWritten, 'Writing the roles');

const roleIdByKey = new Map();
for (const role of roleRows) {
  const written = rolesWritten.data.find((row) => row.title === role.title);
  roleIdByKey.set(role.role_key, written.id);
  console.log(`  Role: ${role.title} (${role.kpis.length} performance measures)`);
}

// 3. Topics, only when the expected splits are being used as a fallback -----
// Every topic of a role goes in one call. A role's expected percentages have to
// add up to 100 and the database checks that at the end of the transaction, so
// they cannot be written one at a time.
if (withSplits) {
  const splits = await readJson('expected_splits.json');
  for (const [roleKey, topics] of Object.entries(splits)) {
    const roleId = roleIdByKey.get(roleKey);
    if (!roleId) stop(`expected_splits.json mentions the role "${roleKey}", which has no document.`);

    const total = topics.reduce((sum, topic) => sum + topic.expected_percent, 0);
    if (Math.abs(total - 100) > 0.01) {
      stop(`The topics for "${roleKey}" add up to ${total} percent. They must add up to 100.`);
    }

    const written = await db.from('topics').upsert(
      topics.map((topic) => ({
        role_id: roleId,
        name: topic.name,
        description: topic.description,
        expected_percent: topic.expected_percent,
        proposed_percent: topic.expected_percent,
        sort_order: topic.sort_order,
      })),
      { onConflict: 'role_id,name' }
    );
    check(written, `Writing the topics for ${roleKey}`);
  }
  console.log(`  Topics: loaded for ${Object.keys(splits).length} roles`);
}

// 4. People -----------------------------------------------------------------
// access_token is left out on purpose. The database makes one on the first
// insert and a later run must not change it, or every personal link already
// handed out would stop working.
const peopleData = await readJson('people.json');

const peopleWritten = await db
  .from('people')
  .upsert(
    peopleData.map((person) => ({
      company_id: companyId,
      role_id: roleIdByKey.get(person.role_key) ?? null,
      full_name: person.full_name,
      email: person.email,
      app_role: person.app_role,
      team: person.team,
      hourly_cost_eur: person.hourly_cost_eur,
      calendar_id: person.calendar_id,
      working_minutes_per_day: person.working_minutes_per_day,
    })),
    { onConflict: 'company_id,full_name' }
  )
  .select('id, full_name, app_role, access_token');
check(peopleWritten, 'Writing the people');

const personByKey = new Map();
for (const person of peopleData) {
  const written = peopleWritten.data.find((row) => row.full_name === person.full_name);
  personByKey.set(person.key, { ...person, id: written.id, access_token: written.access_token });
}

// Managers, once everybody has an id.
for (const person of peopleData) {
  if (!person.manager_key) continue;
  const managerId = personByKey.get(person.manager_key)?.id;
  if (!managerId) stop(`${person.full_name} has manager_key "${person.manager_key}", who is not in people.json.`);
  const linked = await db
    .from('people')
    .update({ manager_id: managerId })
    .eq('id', personByKey.get(person.key).id);
  check(linked, `Linking ${person.full_name} to their manager`);
}
console.log(`  People: ${peopleData.length}`);

// 5. Transcripts ------------------------------------------------------------
const transcriptFiles = (await readdir(path.join(DATA, 'transcripts')))
  .filter((name) => name.endsWith('.txt'))
  .sort();

const transcriptRows = [];
for (const fileName of transcriptFiles) {
  const parsed = parseTranscript(
    fileName,
    await readFile(path.join(DATA, 'transcripts', fileName), 'utf8')
  );
  const owner = personByKey.get(parsed.person_key);
  if (!owner) stop(`${fileName} belongs to "${parsed.person_key}", who is not in people.json.`);
  transcriptRows.push({
    person_id: owner.id,
    title: parsed.title,
    occurred_at: parsed.occurred_at,
    minutes: parsed.minutes,
    in_calendar: parsed.in_calendar,
    body: parsed.body,
  });
}

if (transcriptRows.length > 0) {
  const written = await db
    .from('transcripts')
    .upsert(transcriptRows, { onConflict: 'person_id,title,occurred_at' });
  check(written, 'Writing the transcripts');
}
console.log(`  Transcripts: ${transcriptRows.length}`);

// 6. Calendar activities, only as a fallback --------------------------------
if (withCalendar) {
  const events = await readJson('calendar_week.json');
  const elena = personByKey.get('elena');
  if (!elena) stop('calendar_week.json is Elena\'s week, and Elena is not in people.json.');

  const rows = events.map((event) => ({
    person_id: elena.id,
    day: event.start.slice(0, 10),
    source: 'calendar',
    title: event.title,
    description: event.description ?? null,
    starts_at: event.start,
    ends_at: event.end,
    minutes: Math.round((new Date(event.end) - new Date(event.start)) / 60000),
    attendees: event.attendees ?? [],
  }));

  const days = [...new Set(rows.map((row) => row.day))];
  const cleared = await db
    .from('activities')
    .delete()
    .eq('person_id', elena.id)
    .eq('source', 'calendar')
    .in('day', days);
  check(cleared, 'Clearing the old calendar activities');

  const written = await db.from('activities').insert(rows);
  check(written, 'Writing the calendar activities');
  console.log(`  Calendar activities: ${rows.length} across ${days.length} days`);
}

// 7. The three weeks of approved history ------------------------------------
const history = await readJson('history.json');

const checkInsWritten = await db
  .from('check_ins')
  .upsert(
    history.check_ins.map((entry) => ({
      person_id: personByKey.get(entry.person_key).id,
      day: entry.day,
      status: entry.status,
      invited_at: atMadrid(entry.day, '07:30'),
      submitted_at: atMadrid(entry.day, '17:30'),
      approved_by: personByKey.get(entry.approved_by_key)?.id ?? null,
      approved_at: atMadrid(entry.day, '18:00'),
      summary_text: entry.summary_text,
    })),
    { onConflict: 'person_id,day' }
  )
  .select('id, person_id, day');
check(checkInsWritten, 'Writing the history check ins');

const checkInIdFor = new Map(
  checkInsWritten.data.map((row) => [`${row.person_id}|${row.day}`, row.id])
);

// Topic names only turn into topic ids once the topics exist, which is either
// after scenario one has run or after this script has run with --with-splits.
// Without them an allocation still carries its label, which is what the
// summary screen reads.
const topics = await db.from('topics').select('id, name, role_id');
check(topics, 'Reading the topics');
const topicIdFor = new Map(topics.data.map((row) => [`${row.role_id}|${row.name}`, row.id]));

const allocationRows = [];
let unmatchedTopics = 0;
for (const entry of history.check_ins) {
  const person = personByKey.get(entry.person_key);
  const checkInId = checkInIdFor.get(`${person.id}|${entry.day}`);
  const roleId = roleIdByKey.get(person.role_key);

  for (const allocation of entry.allocations) {
    let topicId = null;
    if (allocation.topic_name) {
      topicId = topicIdFor.get(`${roleId}|${allocation.topic_name}`) ?? null;
      if (!topicId) unmatchedTopics += 1;
    }
    allocationRows.push({
      check_in_id: checkInId,
      person_id: person.id,
      day: entry.day,
      topic_id: topicId,
      label: allocation.label,
      in_role: allocation.in_role,
      minutes: allocation.minutes,
      percent: allocation.percent,
      evidence: allocation.evidence,
      employee_adjusted: allocation.employee_adjusted ?? false,
    });
  }
}

// day_allocations has no natural key, so the old rows go first.
const clearedAllocations = await db
  .from('day_allocations')
  .delete()
  .in('check_in_id', [...checkInIdFor.values()]);
check(clearedAllocations, 'Clearing the old history allocations');

const allocationsWritten = await db.from('day_allocations').insert(allocationRows);
check(allocationsWritten, 'Writing the history allocations');

console.log(`  History: ${history.check_ins.length} approved days, ${allocationRows.length} allocations`);
if (unmatchedTopics > 0) {
  console.log(
    `  Note: ${unmatchedTopics} allocations kept their label but have no topic id yet.\n` +
      '        That is expected until the role splits exist. Run scenario one, or\n' +
      '        seed again with --with-splits, and the ids fill in.'
  );
}

// 8. The personal links, for Marcus -----------------------------------------
// This file holds secrets. It is in .gitignore and must stay there.
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const order = ['tomas', 'elena', 'priya', 'jonas'];
const listed = [...order.filter((key) => personByKey.has(key)), ...[...personByKey.keys()].filter((key) => !order.includes(key))];

const linksFile = [
  '# Demo links',
  '',
  'Written by `node scripts/seed.mjs`. **Never commit this file.** It is in',
  '`.gitignore` because each link signs the person in without a password.',
  '',
  `Generated for ${appUrl}`,
  '',
  '| Person | Role in the app | Person id | Personal link |',
  '|---|---|---|---|',
  ...listed.map((key) => {
    const person = personByKey.get(key);
    return `| ${person.full_name} | ${person.app_role} | \`${person.id}\` | ${appUrl}/enter/${person.access_token} |`;
  }),
  '',
  'The morning email sends the same link with a check in on the end:',
  '`/enter/<access_token>?next=/check-in/<check_in_id>`.',
  '',
].join('\n');

await writeFile(path.join(ROOT, 'docs', 'demo_links.md'), linksFile);

console.log('\n  Person ids:');
for (const key of listed) {
  const person = personByKey.get(key);
  console.log(`    ${person.full_name.padEnd(12)} ${person.app_role.padEnd(9)} ${person.id}`);
}
console.log('\n  Personal links written to docs/demo_links.md, which is not committed.');
console.log('\nDone.\n');
