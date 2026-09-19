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

// Where each module puts its reply. Both were read off a real run, not guessed:
// ai-tools:Ask answers in "answer", the Anthropic module in content[1].text.
const AI_OUTPUT = AI_PROVIDER_CONN ? '{{5.answer}}' : '{{5.content[1].text}}';

const repoRoot = path.resolve(import.meta.dirname, '..');
const interviewPrompt = fs.readFileSync(
  path.join(repoRoot, 'prompts', '02_interview_turn.md'),
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
      max_tokens: 600,
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

  const routeAsksQuestion = [
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

const blueprint = scoutFourBlueprint();

if (dry) {
  console.log(JSON.stringify(blueprint, null, 2));
  process.exit(0);
}

const result = await upsertScenario(blueprint.name, blueprint);
console.log(`${result.action} "${blueprint.name}" id=${result.id} http=${result.res.status}`);
if (result.res.status >= 400) {
  console.log(JSON.stringify(result.res.json, null, 1).slice(0, 1500));
  process.exit(1);
}

const check = await call(`/scenarios/${result.id}`);
const s = check.json.scenario ?? {};
console.log(`  invalid=${s.isinvalid}  packages=${(s.usedPackages ?? []).join(', ')}`);
if (AI_PROVIDER_CONN) {
  console.log(`  note: using Make's own AI provider at the "${AI_TIER}" tier, not Claude.`);
} else if (!ANTHROPIC_CONN) {
  console.log('  note: no Anthropic connection yet, so the Claude module still needs one picking.');
}
if (SUPABASE_URL.includes('REPLACE-ME')) {
  console.log('  note: the Supabase address is still a placeholder. Set SUPABASE_URL and run again.');
}
