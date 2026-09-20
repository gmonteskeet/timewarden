// Gives "Scout 8: Decision and draft creation" the last three modules it needs:
// the call that creates the draft scenario in make.com, saving the draft on the
// suggestion, and the reply with the link.
//
// YOU run this yourself, in your own terminal. No assistant ever sees the token.
//
//   node scripts/set_scout8_token.mjs            add or fill the modules
//   node scripts/set_scout8_token.mjs --dry-run  show what would change, no token needed
//
// The token is typed in with the echo switched off, held in memory only, and
// never printed, logged or written to a file. The only place it ends up is
// inside the scenario's own HTTP module in make.com, which is where make.com
// keeps every other credential.
//
// Before changing anything the script saves the scenario's current blueprint to
// ../make_backups/, outside the repository, because that file holds keys.
//
// To undo: open the backup it names, copy the blueprint, and paste it over the
// scenario in the make.com editor (three dots, then Import Blueprint).

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const API = 'https://eu1.make.com/api/v2';
const SCENARIO_NAME = 'Scout 8: Decision and draft creation';
const TEAM_ID = 2861318;
const DRAFTS_FOLDER_ID = 393630;
const BACKUP_DIR = path.join(import.meta.dirname, '..', '..', 'make_backups');

const dryRun = process.argv.includes('--dry-run');

/** Asks for the token with the echo off, so it never appears on screen. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      if (['\n', '\r', '\u0004'].includes(char.toString('utf8'))) process.stdin.removeListener('data', onData);
      else readline.clearLine(process.stdout, 0), readline.cursorTo(process.stdout, 0), process.stdout.write(question);
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const mask = (value) => (value ? `${value.slice(0, 2)}${'.'.repeat(8)}${value.slice(-2)}` : '(none)');

async function api(token, pathname, method = 'GET', body) {
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    // The message can name the call and the status, never the token.
    throw new Error(`make.com replied ${response.status} to ${method} ${pathname}. ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// The three modules that are added to the approved route
// ---------------------------------------------------------------------------

const httpDefaults = {
  ca: '',
  qs: [],
  gzip: true,
  timeout: '',
  useMtls: false,
  authPass: '',
  authUser: '',
  bodyType: 'raw',
  contentType: 'application/json',
  serializeUrl: false,
  shareCookies: false,
  followRedirect: true,
  useQuerystring: false,
  followAllRedirects: false,
  rejectUnauthorized: true,
};

/** The modules to add, in order. The token goes only into module 24's header. */
function newModules(token, supabase) {
  const draftBlueprint = {
    id: 33,
    module: 'json:CreateJSON',
    version: 1,
    parameters: { type: supabase.draftBlueprintStructure, space: '' },
    mapper: {
      name: '{{17.scenario_name}}',
      flow: [
        {
          id: 1,
          module: 'google-sheets:filterRows',
          version: 2,
          parameters: {},
          mapper: { from: 'drive', spreadsheetId: '', sheetId: '{{17.source_sheet_name}}', includesHeaders: true, tableFirstRow: 'A1:Z1', limit: 200 },
          metadata: { designer: { x: 0, y: 0, name: 'read the source sheet' } },
        },
        {
          id: 2,
          module: 'util:TextAggregator',
          version: 1,
          parameters: { feeder: 1, rowSeparator: '\n' },
          // Written this way so make.com puts the braces into the draft instead
          // of working them out while the draft is being built.
          mapper: { value: '{{"{" + "{1.`0`}" + "} | " + "{" + "{1.`1`}" + "} | " + "{" + "{1.`2`}" + "} | " + "{" + "{1.`3`}" + "}"}}' },
          metadata: { designer: { x: 300, y: 0, name: 'every row as one block of text' } },
        },
        {
          id: 3,
          module: 'anthropic-claude:createAMessage',
          version: 1,
          parameters: { __IMTCONN__: supabase.anthropicConnection },
          mapper: {
            model: 'claude-sonnet-4-5',
            max_tokens: 2000,
            temperature: 0.2,
            messages: [{ role: 'user', inputType: 'single', content: '{{17.summary_prompt}}\n\nThe rows from the sheet, one per line:\n{{"{" + "{2.text}" + "}"}}' }],
          },
          metadata: { designer: { x: 600, y: 0, name: 'write the summary' } },
        },
        {
          id: 4,
          module: 'google-email:createADraft',
          version: 4,
          parameters: {},
          mapper: { to: '{{17.recipients}}', subject: '{{17.scenario_name}}', bodyType: 'rawHtml', content: '{{"{" + "{3.content[1].text}" + "}"}}' },
          metadata: { designer: { x: 900, y: 0, name: 'save the summary as a draft email' } },
        },
      ],
      metadata: {
        instant: false,
        version: 1,
        zone: 'eu1.make.com',
        scenario: { roundtrips: 1, maxErrors: 3, autoCommit: true, autoCommitTriggerLast: true, sequential: false, confidential: false, dataloss: false, dlq: false, freshVariables: false },
        designer: { orphans: [] },
      },
    },
    metadata: { designer: { x: 3300, y: 300, name: 'build the draft blueprint' } },
  };

  const scheduling = {
    id: 34,
    module: 'json:CreateJSON',
    version: 1,
    parameters: { type: supabase.schedulingStructure, space: '' },
    mapper: {
      type: 'weekly',
      days: ['{{switch(lower(17.schedule.day); "monday"; 1; "tuesday"; 2; "wednesday"; 3; "thursday"; 4; "friday"; 5; 5)}}'],
      time: '{{ifempty(17.schedule.time; "14:00")}}',
    },
    metadata: { designer: { x: 3600, y: 300, name: 'build the schedule' } },
  };

  const requestBody = {
    id: 35,
    module: 'json:CreateJSON',
    version: 1,
    parameters: { type: supabase.createBodyStructure, space: '' },
    mapper: { teamId: TEAM_ID, folderId: DRAFTS_FOLDER_ID, blueprint: '{{33.json}}', scheduling: '{{34.json}}' },
    metadata: { designer: { x: 3900, y: 300, name: 'build the make.com request' } },
  };

  const createDraft = {
    id: 24,
    module: 'http:ActionSendData',
    version: 3,
    parameters: { handleErrors: false, useNewZLibDeCompress: true },
    mapper: {
      ...httpDefaults,
      url: `${API}/scenarios?confirmed=true`,
      method: 'post',
      data: '{{35.json}}',
      parseResponse: true,
      stopOnHttpError: true,
      headers: [
        { name: 'Authorization', value: `Token ${token}` },
        { name: 'Content-Type', value: 'application/json' },
      ],
    },
    metadata: { designer: { x: 4200, y: 300, name: 'create the draft scenario' } },
    onerror: [
      {
        id: 25,
        module: 'gateway:WebhookRespond',
        version: 1,
        parameters: {},
        mapper: {
          status: 200,
          body: '{"ok":false,"message":"The draft scenario could not be created in make.com. The approval is saved, so you can try again."}',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
        },
        metadata: { designer: { x: 4200, y: 600, name: 'tell the interface it failed' } },
      },
    ],
  };

  const saveOnSuggestion = {
    id: 28,
    module: 'json:CreateJSON',
    version: 1,
    parameters: { type: supabase.draftedPatchStructure, space: '' },
    mapper: {
      status: 'drafted',
      make_scenario_id: '{{24.data.scenario.id}}',
      make_scenario_url: `https://eu1.make.com/${TEAM_ID}/scenarios/{{24.data.scenario.id}}/edit`,
    },
    metadata: { designer: { x: 4500, y: 300, name: 'build the suggestion update' } },
  };

  const patchSuggestion = {
    id: 29,
    module: 'http:ActionSendData',
    version: 3,
    parameters: { handleErrors: false, useNewZLibDeCompress: true },
    mapper: {
      ...httpDefaults,
      url: `${supabase.url}/rest/v1/candidates?id=eq.{{1.candidate_id}}`,
      method: 'patch',
      data: '{{28.json}}',
      parseResponse: false,
      stopOnHttpError: true,
      headers: supabase.headers,
    },
    metadata: { designer: { x: 4800, y: 300, name: 'save the draft on the suggestion' } },
  };

  const reply = {
    id: 36,
    module: 'gateway:WebhookRespond',
    version: 1,
    parameters: {},
    mapper: {
      status: 200,
      body: `{"ok": true, "make_scenario_url": "https://eu1.make.com/${TEAM_ID}/scenarios/{{24.data.scenario.id}}/edit"}`,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    },
    metadata: { designer: { x: 5100, y: 300, name: 'answer the interface' } },
  };

  return [draftBlueprint, scheduling, requestBody, createDraft, saveOnSuggestion, patchSuggestion, reply];
}

// ---------------------------------------------------------------------------

/** The approved route is the last route of the router, the one with the Claude call. */
function approvedRoute(blueprint) {
  const router = blueprint.flow.find((m) => m.module === 'builtin:BasicRouter');
  if (!router) throw new Error('This scenario has no router. It is not the one this script expects.');
  const route = router.routes.find((r) => r.flow.some((m) => m.module === 'anthropic-claude:createAMessage'));
  if (!route) throw new Error('No route in this scenario calls Claude. It is not the one this script expects.');
  return route;
}

/** Reads the settings the new modules need out of the modules that are already there. */
function settingsFrom(route) {
  const claude = route.flow.find((m) => m.module === 'anthropic-claude:createAMessage');
  const anySupabase = route.flow.find((m) => m.module === 'http:ActionSendData' && String(m.mapper?.url).includes('/rest/v1/'));
  if (!claude || !anySupabase) throw new Error('This scenario does not hold the Claude and database modules this script expects.');
  const url = String(anySupabase.mapper.url).split('/rest/v1/')[0];
  return {
    anthropicConnection: claude.parameters.__IMTCONN__,
    url,
    headers: anySupabase.mapper.headers,
  };
}

async function main() {
  console.log('Scout 8: adding the step that creates the draft scenario.\n');

  let token = '';
  if (dryRun) {
    console.log('Dry run: no token is asked for and nothing is changed.\n');
  } else {
    token = await askHidden('Paste the make.com API token (it will not be shown): ');
    if (!token) {
      console.error('No token was given. Nothing has changed.');
      process.exit(1);
    }
    console.log(`Token read: ${mask(token)}. It stays in memory only.\n`);
  }

  // 1. Find the scenario
  const scenarios = dryRun ? null : await api(token, `/scenarios?teamId=${TEAM_ID}`);
  const found = dryRun ? { id: '(the scenario)', name: SCENARIO_NAME } : (scenarios.scenarios ?? []).find((s) => s.name === SCENARIO_NAME);
  if (!found) {
    console.error(`No scenario named "${SCENARIO_NAME}" in this team. Nothing has changed.`);
    process.exit(1);
  }
  console.log(`Found "${found.name}".`);

  // 2. Back the blueprint up before touching anything
  let blueprint;
  if (dryRun) {
    const saved = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('Scout 8')).sort().pop() : null;
    if (!saved) {
      console.log('\nDry run with no saved copy of Scout 8 to read, so only the plan is shown:');
      console.log('  1. Save the current blueprint to ../make_backups/');
      console.log('  2. Add, on the approved route: build the draft blueprint, build the schedule,');
      console.log('     build the make.com request, create the draft scenario (the token goes in this');
      console.log('     one header), save the draft on the suggestion, and the reply with the link.');
      console.log('  3. Read the scenario back and confirm the module is there.');
      console.log(`\nThe header would be: Authorization: Token ${mask('xxxxxxxxxxxx')}`);
      return;
    }
    blueprint = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, saved), 'utf8')).response.blueprint;
    console.log(`Dry run against the saved copy ${saved}.`);
  } else {
    const got = await api(token, `/scenarios/${found.id}/blueprint`);
    blueprint = got.response.blueprint;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(11, 16).replace(':', '');
    const file = path.join(BACKUP_DIR, `Scout 8 Decision and draft creation ${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(got, null, 2));
    console.log(`Saved a backup: ${file}`);
  }

  // 3. Work out what to change
  const route = approvedRoute(blueprint);
  const settings = settingsFrom(route);
  const structures = {
    draftBlueprintStructure: 590829,
    schedulingStructure: 590831,
    createBodyStructure: 590830,
    draftedPatchStructure: 590832,
  };
  const existing = route.flow.find((m) => m.module === 'http:ActionSendData' && String(m.mapper?.url).includes('/api/v2/scenarios'));

  if (existing) {
    const header = (existing.mapper.headers ?? []).find((h) => h.name === 'Authorization');
    const hasToken = header && String(header.value).replace('Token', '').trim().length > 6 && !String(header.value).includes('REPLACE');
    if (hasToken) {
      console.log('\nThe step is already there and its header already holds a token. Nothing to do.');
      return;
    }
    console.log('\nThe step is already there with an empty header. Only the header will be filled.');
    if (dryRun) {
      console.log(`Would set: Authorization: Token ${mask('xxxxxxxxxxxx')}`);
      return;
    }
    existing.mapper.headers = [
      { name: 'Authorization', value: `Token ${token}` },
      { name: 'Content-Type', value: 'application/json' },
    ];
  } else {
    const toAdd = newModules(dryRun ? 'DRY-RUN' : token, { ...settings, ...structures });
    console.log('\nThese modules go on the approved route, after the reply from Claude is read:');
    for (const m of toAdd) console.log(`  ${m.id}. ${m.metadata.designer.name}  (${m.module})`);
    console.log(`The token goes into one header only: module 24, Authorization: Token ${mask(dryRun ? 'xxxxxxxxxxxx' : token)}`);
    if (dryRun) {
      console.log('\nDry run: nothing was sent to make.com.');
      return;
    }
    // The existing reply module is replaced by the one that carries the link.
    const replyIndex = route.flow.findIndex((m) => m.module === 'gateway:WebhookRespond' && String(m.mapper?.body).includes('draft_values'));
    if (replyIndex >= 0) route.flow.splice(replyIndex, 1);
    route.flow.push(...toAdd);
  }

  // 4. Save it
  await api(token, `/scenarios/${found.id}?confirmed=true`, 'PATCH', { blueprint: JSON.stringify(blueprint) });
  console.log('\nSaved.');

  // 5. Read it back and check, without printing the header
  const after = (await api(token, `/scenarios/${found.id}/blueprint`)).response.blueprint;
  const check = approvedRoute(after).flow.find((m) => m.module === 'http:ActionSendData' && String(m.mapper?.url).includes('/api/v2/scenarios'));
  const headerSet = !!(check?.mapper?.headers ?? []).find((h) => h.name === 'Authorization' && String(h.value).length > 8);
  console.log(`Checked: the step that creates the draft is ${check ? 'there' : 'MISSING'}, and its header is ${headerSet ? 'set' : 'EMPTY'}.`);
  if (!check || !headerSet) {
    console.log('Something is wrong. Restore the backup named above in the make.com editor.');
    process.exit(1);
  }

  console.log('\nWhat happens now: when the manager approves a suggestion, Scout 8 creates a draft');
  console.log('scenario in the folder "Workflow Scout drafts", switched off, and the link appears');
  console.log('on the Suggestions screen.');
  console.log('\nTo undo: open the backup file named above, copy the blueprint, and paste it over the');
  console.log('scenario in the make.com editor (the three dots, then Import Blueprint).');
}

main().catch((error) => {
  console.error(`\nStopped: ${error.message}`);
  console.error('Nothing else was changed. If a backup was saved above, the scenario can be put back from it.');
  process.exit(1);
});
