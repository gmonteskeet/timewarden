// Builds the Workflow Scout scenarios in make.com through the API, instead of
// clicking them together in the editor. Task G7 allows this: "If Gerson
// connects the make.com MCP server or gives you an API token, you may build
// scenarios through the API".
//
// Nothing secret lives in this file. Everything comes from the environment:
//
//   MAKE_API_TOKEN              the token from Profile, API access
//   MAKE_TEAM_ID                numeric team id
//   MAKE_FOLDER_ID              the "Workflow Scout" folder
//   MAKE_HOOK_INTERVIEW         hook id for Scout 4
//   MAKE_HOOK_SUMMARY_URL       the address of Scout 5's webhook
//   MAKE_DS_RPC_REQUEST         data structure ids, see docs/decisions.md
//   MAKE_DS_INTERVIEW_REPLY
//   MAKE_DS_INTERVIEW_RESPONSE
//   MAKE_ANTHROPIC_CONNECTION   optional until the connection exists
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SCOUT_SHARED_SECRET
//
// Run it again after any of those change and it updates the scenario in place.
//
//   node scripts/make_build.mjs                 build or update Scout 4
//   node scripts/make_build.mjs --dry           print the blueprint, send nothing

import fs from 'node:fs';
import path from 'node:path';

const dry = process.argv.includes('--dry');
const ZONE = process.env.MAKE_ZONE ?? 'eu1';
const API = `https://${ZONE}.make.com/api/v2`;

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See the list at the top of this file.`);
    process.exit(1);
  }
  return v;
}
const soft = (name, fallback) => process.env[name] ?? fallback;

const TOKEN = need('MAKE_API_TOKEN');
const TEAM = Number(need('MAKE_TEAM_ID'));
const FOLDER = Number(need('MAKE_FOLDER_ID'));
const HOOK_INTERVIEW = Number(need('MAKE_HOOK_INTERVIEW'));
const HOOK_SUMMARY_URL = need('MAKE_HOOK_SUMMARY_URL');
const DS_REQ = Number(need('MAKE_DS_RPC_REQUEST'));
const DS_REPLY = Number(need('MAKE_DS_INTERVIEW_REPLY'));
const DS_RESP = Number(need('MAKE_DS_INTERVIEW_RESPONSE'));
const HOOK_SUMMARY = Number(soft('MAKE_HOOK_SUMMARY', '0'));
const DS_SUMMARY = Number(soft('MAKE_DS_SUMMARY', '0'));
const DS_SUMMARY_REQ = Number(soft('MAKE_DS_SUMMARY_REQUEST', '0'));
const DS_ALLOC_ROW = Number(soft('MAKE_DS_ALLOC_ROW', '0'));
const DS_ACT_ROW = Number(soft('MAKE_DS_ACT_ROW', '0'));

// These three are the ones that are still missing while the accounts are being
// set up. Obvious placeholders, so a half built scenario cannot quietly point
// at the wrong database.
const SUPABASE_URL = soft('SUPABASE_URL', 'https://REPLACE-ME.supabase.co');
const SERVICE_KEY = soft('SUPABASE_SERVICE_ROLE_KEY', 'REPLACE-ME-SERVICE-ROLE-KEY');
const SHARED_SECRET = soft('SCOUT_SHARED_SECRET', 'REPLACE-ME-SHARED-SECRET');
const ANTHROPIC_CONN = process.env.MAKE_ANTHROPIC_CONNECTION
  ? Number(process.env.MAKE_ANTHROPIC_CONNECTION)
  : null;
const MODEL = soft('MAKE_CLAUDE_MODEL', 'claude-sonnet-4-5');

// Two ways to reach a model. Anthropic Claude is what AGENTS.md section 3 asks
// for. Make's own AI provider needs no key at all and is what we fall back to
// while there is no Anthropic key. See docs/decisions.md.
const AI_PROVIDER_CONN = process.env.MAKE_AI_PROVIDER_CONNECTION
  ? Number(process.env.MAKE_AI_PROVIDER_CONNECTION)
  : null;
const AI_TIER = soft('MAKE_AI_TIER', 'large');

// Where each module puts its reply. Both read off real runs, not guessed.
// ai-tools:Ask answers in "answer".
// The Anthropic module returns a list of content blocks, and claude-sonnet-5
// puts a "thinking" block in front of the "text" one whenever it reasons about
// the day. So content[1] is sometimes the thinking block and its text is empty,
// which is why this picks the text block by its type instead of by position.
const AI_EXPR = AI_PROVIDER_CONN
  ? '5.answer'
  : 'first(map(5.content; "text"; "type"; "text"))';

// Now and again a model wraps its JSON in a markdown fence even when the prompt
// says not to, and Parse JSON answers "Source is not valid JSON". Stripping the
// fence costs nothing and turns an intermittent failure into a non event.
const FENCE = String.fromCharCode(96, 96, 96);
const AI_OUTPUT = '{{trim(replace(' + AI_EXPR + '; "/' + FENCE + '(json)?/g"; emptystring))}}';

const repoRoot = path.resolve(import.meta.dirname, '..');
const interviewPrompt = fs.readFileSync(
  path.join(repoRoot, 'prompts', '02_interview_turn.md'),
  'utf8'
);
const summaryPrompt = fs.readFileSync(
  path.join(repoRoot, 'prompts', '03_day_summary.md'),
  'utf8'
);

// ---------------------------------------------------------------------------
// Small helpers for the bits of a blueprint that repeat
// ---------------------------------------------------------------------------

const at = (x, y, name) => ({ designer: { x, y, name } });

const supabaseHeaders = () => [
  { name: 'apikey', value: SERVICE_KEY },
  { name: 'Authorization', value: `Bearer ${SERVICE_KEY}` },
  { name: 'Content-Type', value: 'application/json' },
];

/** HTTP > Make a request. The long list of flags is what the module expects. */
function http({ id, x, y, name, url, method, headers = [], body, parse = false }) {
  return {
    id,
    module: 'http:ActionSendData',
    version: 3,
    parameters: { handleErrors: false, useNewZLibDeCompress: true },
    mapper: {
      url,
      serializeUrl: false,
      method,
      headers,
      qs: [],
      bodyType: body === undefined ? 'raw' : 'raw',
      parseResponse: parse,
      // Without this a 4xx is ignored and the run goes green while nothing is
      // written. That cost an hour: the summary said "summarised" with no
      // allocations behind it.
      stopOnHttpError: true,
      authUser: '',
      authPass: '',
      timeout: '',
      shareCookies: false,
      ca: '',
      rejectUnauthorized: true,
      followRedirect: true,
      useQuerystring: false,
      gzip: true,
      useMtls: false,
      contentType: 'application/json',
      data: body ?? '',
      followAllRedirects: false,
    },
    metadata: at(x, y, name),
  };
}

const createJson = ({ id, x, y, name, ds, values }) => ({
  id,
  module: 'json:CreateJSON',
  version: 1,
  parameters: { type: ds, space: '' },
  mapper: values,
  metadata: at(x, y, name),
});

const parseJson = ({ id, x, y, name, ds, source }) => ({
  id,
  module: 'json:ParseJSON',
  version: 1,
  parameters: { type: ds },
  mapper: { json: source },
  metadata: at(x, y, name),
});

const respond = ({ id, x, y, name, bodyRef }) => ({
  id,
  module: 'gateway:WebhookRespond',
  version: 1,
  parameters: {},
  mapper: {
    status: '200',
    body: bodyRef,
    headers: [{ key: 'Content-Type', value: 'application/json' }],
  },
  metadata: at(x, y, name),
});

const filter = (name, a, o, b) => ({ name, conditions: [[{ a, o, b }]] });

/**
 * The model call, with everything learned the hard way baked in: the block type
 * on the content, numbers for max_tokens and temperature, and the prompt at the
 * top of the user message because the module has no system prompt field.
 */
function askModel({ id, x, y, name, prompt, inputRef, maxTokens }) {
  const text = prompt + '\n\nHere is the input:\n\n' + inputRef;
  return AI_PROVIDER_CONN
    ? { id, module: 'ai-tools:Ask', version: 2,
        parameters: { model: AI_TIER, makeConnectionId: AI_PROVIDER_CONN },
        mapper: { input: text }, metadata: at(x, y, name) }
    : { id, module: 'anthropic-claude:createAMessage', version: 1,
        parameters: ANTHROPIC_CONN ? { __IMTCONN__: ANTHROPIC_CONN } : {},
        mapper: {
          model: MODEL,
          messages: [{ role: 'user', content: [{ type: 'text', text }] }],
          metadata: {},
          max_tokens: maxTokens,
          temperature: 0.2,
        },
        metadata: at(x, y, name) };
}

/** Where a given model module put its reply, fences stripped. */
function modelOutput(moduleId) {
  const expr = AI_PROVIDER_CONN
    ? moduleId + '.answer'
    : 'first(map(' + moduleId + '.content; "text"; "type"; "text"))';
  return '{{trim(replace(' + expr + '; "/' + FENCE + '(json)?/g"; emptystring))}}';
}

// ---------------------------------------------------------------------------
// Scout 4: Interview turn
// ---------------------------------------------------------------------------

function scoutFourBlueprint() {
  // Neither module has a system prompt field, so the whole prompt goes first
  // and the turn's input follows it.
  const promptText =
    `${interviewPrompt}\n\n` +
    `Here is the input for this turn:\n\n{{3.data.prompt_input}}`;

  const askClaude = {
    id: 5,
    module: 'anthropic-claude:createAMessage',
    version: 1,
    parameters: ANTHROPIC_CONN ? { __IMTCONN__: ANTHROPIC_CONN } : {},
    mapper: {
      model: MODEL,
      // Anthropic requires the block type, even though make's own template omits it.
      messages: [{ role: 'user', content: [{ type: 'text', text: promptText }] }],
      metadata: {},
      // Numbers, not strings. make's own template writes these as strings and
      // Anthropic rejects that with "Input should be a valid integer".
      //
      // Task G7 says 600, which was right before the model had a thinking
      // block. Thinking tokens are spent out of this same budget, so on a long
      // interview 600 ran out mid thought and no text block was ever emitted.
      // The reply itself is still two or three lines; this is headroom, not a
      // longer answer, and the turns still come back in three to four seconds.
      max_tokens: Number(soft('MAKE_MAX_TOKENS', '2000')),
      temperature: 0.2,
    },
    metadata: at(300, 0, 'write the next question'),
  };

  const askMakeAi = {
    id: 5,
    module: 'ai-tools:Ask',
    version: 2,
    parameters: { model: AI_TIER, makeConnectionId: AI_PROVIDER_CONN },
    mapper: { input: promptText },
    metadata: at(300, 0, 'write the next question'),
  };

  const claude = {
    ...(AI_PROVIDER_CONN ? askMakeAi : askClaude),
    filter: filter(
      'Scout still has questions',
      '{{3.data.scout_turns_asked}}',
      'number:less',
      '6'
    ),
  };

  const insertTurn = (id, x, name, textRef, kindRef, evidenceRef, flt) => {
    const m = http({
      id,
      x,
      y: 0,
      name,
      url: `${SUPABASE_URL}/rest/v1/interview_turns`,
      method: 'post',
      headers: supabaseHeaders(),
      body: JSON.stringify({
        check_in_id: '{{1.check_in_id}}',
        turn_no: '{{3.data.next_turn_no}}',
        speaker: 'scout',
        text: textRef,
        kind: kindRef,
        evidence: evidenceRef,
      }),
    });
    if (flt) m.filter = flt;
    return m;
  };

  const startSummary = (id, x) =>
    http({
      id,
      x,
      y: 0,
      name: 'start the day summary',
      url: HOOK_SUMMARY_URL,
      method: 'post',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ check_in_id: '{{1.check_in_id}}' }),
    });

  // DEBUG_RAW builds a cut down route A that answers with whatever the model
  // said, unparsed, so a parse failure can actually be read.
  const routeAsksQuestion = process.env.DEBUG_RAW ? [
    claude,
    respond({ id: 9, x: 600, y: 0, name: 'echo the raw reply', bodyRef:
      'TYPES=[{{join(map(5.content; "type"); ",")}}] STOP=[{{5.stop_reason}}] ' +
      'TEXT=[{{first(map(5.content; "text"; "type"; "text"))}}]' }),
    // (DEBUG_RAW only)
  ] : [
    claude,
    parseJson({ id: 6, x: 600, y: 0, name: "read the model's reply", ds: DS_REPLY, source: AI_OUTPUT }),
    insertTurn(7, 900, "save Scout's question", '{{6.question}}', '{{6.kind}}', '{{6.evidence}}'),
    createJson({
      id: 8,
      x: 1200,
      y: 0,
      name: 'build the reply',
      ds: DS_RESP,
      values: {
        ok: true,
        done: '{{6.done}}',
        turn_no: '{{3.data.next_turn_no}}',
        question: '{{6.question}}',
        kind: '{{6.kind}}',
        evidence: '{{6.evidence}}',
      },
    }),
    respond({ id: 9, x: 1500, y: 0, name: 'answer the interface', bodyRef: '{{8.json}}' }),
    {
      ...startSummary(10, 1800),
      filter: filter('the interview is finished', '{{6.done}}', 'boolean:equal', 'true'),
    },
  ];

  const closing =
    'Thank you {{3.data.first_name}}, that gives me a clear picture of your day and your summary is ready.';

  const routeCapReached = [
    insertTurn(
      11,
      300,
      'save the closing line',
      closing,
      'closing',
      '',
      filter(
        'the six question cap is reached',
        '{{3.data.scout_turns_asked}}',
        'number:greaterorequal',
        '6'
      )
    ),
    createJson({
      id: 12,
      x: 600,
      y: 300,
      name: 'build the reply',
      ds: DS_RESP,
      values: {
        ok: true,
        done: true,
        turn_no: '{{3.data.next_turn_no}}',
        question: closing,
        kind: 'closing',
        evidence: '',
      },
    }),
    respond({ id: 13, x: 900, y: 300, name: 'answer the interface', bodyRef: '{{12.json}}' }),
    startSummary(14, 1200),
  ];

  return {
    name: 'Scout 4: Interview turn',
    flow: [
      {
        id: 1,
        module: 'gateway:CustomWebHook',
        version: 1,
        parameters: { hook: HOOK_INTERVIEW, maxResults: 1 },
        mapper: {},
        metadata: at(0, 0, 'Scout 4 interview turn'),
      },
      {
        ...createJson({
          id: 2,
          x: 300,
          y: 0,
          name: 'build the database call',
          ds: DS_REQ,
          values: {
            p_check_in_id: '{{1.check_in_id}}',
            p_employee_text: '{{1.employee_text}}',
          },
        }),
        // A custom webhook with "get request headers" on puts them in
        // __IMTHEADERS__, not in "headers", as a list of name and value pairs
        // rather than a keyed collection. Both of those were read off a real
        // run. This picks the one header we care about out of the list.
        ...(process.env.SKIP_SECRET_FILTER ? {} : { filter: filter(
          'only our own interface',
          '{{first(map(1.__IMTHEADERS__; "value"; "name"; "x-scout-key"))}}',
          'text:equal',
          SHARED_SECRET
        ) }),
      },
      http({
        id: 3,
        x: 600,
        y: 0,
        name: 'read the check in and record the answer',
        url: `${SUPABASE_URL}/rest/v1/rpc/scout_interview_context`,
        method: 'post',
        headers: supabaseHeaders(),
        body: '{{2.json}}',
        parse: true,
      }),
      {
        id: 4,
        module: 'builtin:BasicRouter',
        version: 1,
        mapper: null,
        metadata: at(900, 0, 'has Scout asked six questions'),
        routes: [{ flow: routeAsksQuestion }, { flow: routeCapReached }],
      },
    ],
    metadata: {
      instant: true,
      version: 1,
      scenario: {
        roundtrips: 1,
        maxErrors: 3,
        autoCommit: true,
        autoCommitTriggerLast: true,
        sequential: false,
        confidential: false,
        dataloss: false,
        dlq: false,
        freshVariables: false,
      },
      designer: { orphans: [] },
      zone: `${ZONE}.make.com`,
    },
  };
}

// ---------------------------------------------------------------------------
// Scout 5: Day summary
// ---------------------------------------------------------------------------

function scoutFiveBlueprint() {
  // The model divides the day. Every sum below is make.com's, as task G7 asks.
  const allocs = '5.allocations';
  const working = '3.data.working_minutes';
  // What the day is short by, normally zero.
  const diff = '(' + working + ' - sum(map(' + allocs + '; "minutes")))';
  // The row that absorbs it: a five minute correction to a 230 minute block
  // changes nothing anyone can see.
  const largest = 'get(first(sort(' + allocs + '; "desc"; "minutes")); "label")';
  const rowMinutes = 'if(8.label = ' + largest + '; 8.minutes + ' + diff + '; 8.minutes)';
  const rowPercent = 'round((' + rowMinutes + ') / ' + working + ' * 10000) / 100';

  return {
    name: 'Scout 5: Day summary',
    flow: [
      { id: 1, module: 'gateway:CustomWebHook', version: 1,
        parameters: { hook: HOOK_SUMMARY, maxResults: 1 }, mapper: {},
        metadata: at(0, 0, 'Scout 5 day summary') },

      createJson({ id: 2, x: 300, y: 0, name: 'build the database call',
        ds: DS_SUMMARY_REQ, values: { p_check_in_id: '{{1.check_in_id}}' } }),

      http({ id: 3, x: 600, y: 0, name: 'read the day and the interview',
        url: SUPABASE_URL + '/rest/v1/rpc/scout_summary_context',
        method: 'post', headers: supabaseHeaders(), body: '{{2.json}}', parse: true }),

      askModel({ id: 4, x: 900, y: 0, name: 'write the day summary',
        prompt: summaryPrompt, inputRef: '{{3.data.prompt_input}}', maxTokens: 4000 }),

      parseJson({ id: 5, x: 1200, y: 0, name: "read the model's reply",
        ds: DS_SUMMARY, source: modelOutput(4) }),

      // A model that is an hour out has misread the day, and nudging one row
      // would hide that rather than fix it. The run stops and says why.
      { ...http({ id: 6, x: 1500, y: 0, name: 'clear the old allocations',
          url: SUPABASE_URL + '/rest/v1/day_allocations?check_in_id=eq.{{1.check_in_id}}',
          method: 'delete', headers: supabaseHeaders() }),
        filter: filter('the minutes are close enough',
          '{{abs(' + diff + ')}}', 'number:lessorequal', '60') },

      http({ id: 7, x: 1800, y: 0, name: 'clear the old interview activities',
        url: SUPABASE_URL + '/rest/v1/activities?person_id=eq.{{3.data.person_id}}'
             + '&day=eq.{{3.data.day}}&source=eq.interview',
        method: 'delete', headers: supabaseHeaders() }),

      { id: 8, module: 'builtin:BasicFeeder', version: 1,
        mapper: { array: '{{5.allocations}}' },
        metadata: at(2100, 0, 'each allocation') },

      // Built with Create JSON rather than by hand. A topic_id written straight
      // into a raw body comes out as "" for work outside a role, and Postgres
      // answers 400 invalid input syntax for type uuid. Create JSON leaves an
      // empty field out altogether, which is what the column wants.
      createJson({ id: 9, x: 2400, y: 0, name: 'build the allocation row',
        ds: DS_ALLOC_ROW, values: {
          check_in_id: '{{1.check_in_id}}',
          person_id: '{{3.data.person_id}}',
          day: '{{3.data.day}}',
          // Guarded on in_role. With an empty topic_name the map has nothing to
          // filter on and hands back every topic, so first() would quietly give
          // work outside the role the first topic of the role.
          topic_id: '{{if(8.in_role; first(map(3.data.topic_map; "topic_id"; "name"; 8.topic_name)); null)}}',
          label: '{{8.label}}',
          in_role: '{{8.in_role}}',
          minutes: '{{' + rowMinutes + '}}',
          percent: '{{' + rowPercent + '}}',
          evidence: '{{8.evidence}}',
          employee_adjusted: false,
        } }),

      http({ id: 10, x: 2700, y: 0, name: 'save one allocation',
        url: SUPABASE_URL + '/rest/v1/day_allocations', method: 'post',
        headers: supabaseHeaders(), body: '{{9.json}}' }),

      createJson({ id: 11, x: 3000, y: 0, name: 'build the activity row',
        ds: DS_ACT_ROW, values: {
          person_id: '{{3.data.person_id}}',
          day: '{{3.data.day}}',
          source: 'interview',
          title: '{{8.label}}',
          description: '{{8.evidence}}',
          minutes: '{{' + rowMinutes + '}}',
        } }),

      http({ id: 12, x: 3300, y: 0, name: 'save one activity',
        url: SUPABASE_URL + '/rest/v1/activities', method: 'post',
        headers: supabaseHeaders(), body: '{{11.json}}' }),

      // Collapses the loop back to one bundle, so the check in is marked once
      // and only after every row is written.
      { id: 13, module: 'builtin:BasicAggregator', version: 1,
        parameters: { feeder: 8 }, mapper: {},
        metadata: at(3600, 0, 'wait for every allocation') },

      http({ id: 14, x: 3900, y: 0, name: 'mark the check in summarised',
        url: SUPABASE_URL + '/rest/v1/check_ins?id=eq.{{1.check_in_id}}',
        method: 'patch', headers: supabaseHeaders(),
        body: JSON.stringify({
          summary_text: process.env.DEBUG_ALLOCS
            ? 'ALLOCS={{length(5.allocations)}}'
            : '{{5.summary_text}}',
          status: 'summarised' }) }),
    ],
    metadata: {
      instant: true, version: 1,
      scenario: { roundtrips: 1, maxErrors: 3, autoCommit: true, autoCommitTriggerLast: true,
        sequential: false, confidential: false, dataloss: false, dlq: false, freshVariables: false },
      designer: { orphans: [] }, zone: ZONE + '.make.com',
    },
  };
}

// ---------------------------------------------------------------------------

async function call(pathname, method = 'GET', body) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function upsertScenario(name, blueprint) {
  const existing = await call(`/scenarios?teamId=${TEAM}`);
  const found = (existing.json.scenarios ?? []).find((s) => s.name === name);
  const payload = {
    blueprint: JSON.stringify(blueprint),
    scheduling: JSON.stringify({ type: 'immediately' }),
  };

  if (found) {
    const res = await call(`/scenarios/${found.id}?confirmed=true`, 'PATCH', payload);
    return { action: 'updated', id: found.id, res };
  }
  const res = await call('/scenarios?confirmed=true', 'POST', {
    teamId: TEAM,
    folderId: FOLDER,
    ...payload,
  });
  return { action: 'created', id: res.json.scenario?.id, res };
}

// Which scenarios to build. Default is both.
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const wanted = [
  { key: 'four', make: scoutFourBlueprint },
  { key: 'five', make: scoutFiveBlueprint, needs: HOOK_SUMMARY && DS_SUMMARY && DS_SUMMARY_REQ },
].filter((b) => (only ? b.key === only : true));

for (const b of wanted) {
  if (b.needs === 0) {
    console.log(`skipping Scout ${b.key}: set MAKE_HOOK_SUMMARY, MAKE_DS_SUMMARY and MAKE_DS_SUMMARY_REQUEST first.`);
    continue;
  }
  const blueprint = b.make();
  if (dry) {
    console.log(JSON.stringify(blueprint, null, 2));
    continue;
  }
  const result = await upsertScenario(blueprint.name, blueprint);
  console.log(`${result.action} "${blueprint.name}" id=${result.id} http=${result.res.status}`);
  if (result.res.status >= 400) {
    console.log(JSON.stringify(result.res.json, null, 1).slice(0, 1200));
    process.exitCode = 1;
    continue;
  }
  const check = await call(`/scenarios/${result.id}`);
  const sc = check.json.scenario ?? {};
  console.log(`  invalid=${sc.isinvalid}  modules=${(sc.usedPackages ?? []).length}`);
}
if (dry) process.exit(0);
const s = {};
if (AI_PROVIDER_CONN) {
  console.log(`  note: using Make's own AI provider at the "${AI_TIER}" tier, not Claude.`);
} else if (!ANTHROPIC_CONN) {
  console.log('  note: no Anthropic connection yet, so the Claude module still needs one picking.');
}
if (SUPABASE_URL.includes('REPLACE-ME')) {
  console.log('  note: the Supabase address is still a placeholder. Set SUPABASE_URL and run again.');
}
