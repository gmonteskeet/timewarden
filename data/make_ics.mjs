// Writes data/elena_week.ics from data/calendar_week.json, for import into Google Calendar.
// No dependencies. Run with: node data/make_ics.mjs
// The output is identical on every run: DTSTAMP is fixed and UIDs come from each event's start and title.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const events = JSON.parse(readFileSync(join(here, 'calendar_week.json'), 'utf8'));

const TZID = 'Europe/Madrid';
const DTSTAMP = '20260919T120000Z';
const DOMAIN = 'brightline.example';

// Local Madrid wall clock time in iCalendar form, for example 20260914T090000.
const madrid = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZID, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function localTime(iso) {
  const p = Object.fromEntries(madrid.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

// Text values: escape backslashes, semicolons, commas and new lines.
const escapeText = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Made up, unsendable address for every attendee: firstname.lastname@brightline.example
function address(fullName) {
  const parts = slug(fullName).split('-');
  return `${parts[0]}.${parts[parts.length - 1]}@${DOMAIN}`;
}

// Fold lines longer than 75 bytes; continuation lines start with one space.
function fold(line) {
  const out = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > 75) {
      out.push(current);
      current = ' ';
    }
    current += ch;
  }
  out.push(current);
  return out;
}

const lines = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Brightline Advisory//Workflow Scout demo calendar//EN',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  `X-WR-CALNAME:${escapeText('Scout demo: Elena Ruiz')}`,
  `X-WR-TIMEZONE:${TZID}`,
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

for (const e of events) {
  const start = localTime(e.start);
  lines.push(
    'BEGIN:VEVENT',
    `UID:${start}-${slug(e.title)}@${DOMAIN}`,
    `DTSTAMP:${DTSTAMP}`,
    `DTSTART;TZID=${TZID}:${start}`,
    `DTEND;TZID=${TZID}:${localTime(e.end)}`,
    `SUMMARY:${escapeText(e.title)}`,
  );
  if (e.description && e.description.trim() !== '') lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  for (const name of e.attendees) lines.push(`ATTENDEE;CN="${name.replace(/"/g, '')}":mailto:${address(name)}`);
  lines.push('END:VEVENT');
}
lines.push('END:VCALENDAR');

const ics = lines.flatMap(fold).join('\r\n') + '\r\n';
writeFileSync(join(here, 'elena_week.ics'), ics);
console.log(`Wrote ${events.length} events to data/elena_week.ics`);
