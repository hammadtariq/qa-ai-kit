#!/usr/bin/env node
// QA Kit TestRail MCP server.
// Zero dependencies: speaks MCP (JSON-RPC 2.0 over newline-delimited stdio) and
// calls the TestRail API v2 with Node's built-in fetch. Requires Node 18+.
//
// Scope and guardrails:
//   - One TestRail project per repo, read from .qa/config.json (or env).
//   - No delete tools at all; retired cases are moved to a section instead.
//   - New and rewritten cases are marked "AI draft" when a review field is configured, and this
//     server refuses to set that field to "approved": approval is a human gate.
//
// Credentials come from the environment (TESTRAIL_URL, TESTRAIL_USER,
// TESTRAIL_API_KEY) or from a gitignored .env file in the project root.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const SERVER_INFO = { name: 'qa-kit-testrail', version: '0.3.0' };
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const STATUS = { 1: 'passed', 2: 'blocked', 3: 'untested', 4: 'retest', 5: 'failed' };

// ---------------------------------------------------------------- config

function projectDir() {
  const fromEnv = process.env.QA_PROJECT_DIR;
  if (fromEnv && !fromEnv.includes('${')) return fromEnv;
  return process.cwd();
}

function parseDotEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function loadConfig() {
  const dir = projectDir();
  const dotenv = parseDotEnv(join(dir, '.env'));
  const env = (k) => process.env[k] || dotenv[k] || '';
  let qa = {};
  const cfgPath = join(dir, '.qa', 'config.json');
  if (existsSync(cfgPath)) {
    try { qa = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch (e) {
      return { error: `.qa/config.json is not valid JSON: ${e.message}` };
    }
  }
  const tr = qa.testrail || {};
  const cfg = {
    dir,
    url: env('TESTRAIL_URL').replace(/\/+$/, ''),
    user: env('TESTRAIL_USER'),
    key: env('TESTRAIL_API_KEY'),
    projectId: Number(env('TESTRAIL_PROJECT_ID') || tr.projectId || 0),
    suiteId: Number(env('TESTRAIL_SUITE_ID') || tr.suiteId || 0) || null,
    templateId: tr.templateId || null,
    reviewField: tr.reviewField || null,       // { field, draft, approved }
    automatedField: tr.automatedField || null, // { field, value }
  };
  const missing = [];
  if (!cfg.url) missing.push('TESTRAIL_URL');
  if (!cfg.user) missing.push('TESTRAIL_USER');
  if (!cfg.key) missing.push('TESTRAIL_API_KEY');
  if (!cfg.projectId) missing.push('testrail.projectId in .qa/config.json (or TESTRAIL_PROJECT_ID)');
  if (missing.length) {
    return { error: `TestRail is not configured. Missing: ${missing.join(', ')}. Looked in ${dir}. Run /qa-kit:setup-project or see docs/AGENCY-SETUP.md.` };
  }
  return cfg;
}

// ---------------------------------------------------------------- http

class TestRailError extends Error {}

async function api(cfg, method, endpoint, { query = {}, body } = {}) {
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('');
  const url = `${cfg.url}/index.php?/api/v2/${endpoint}${qs}`;
  const auth = Buffer.from(`${cfg.user}:${cfg.key}`).toString('base64');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || 5);
      await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000));
      continue;
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
    if (!res.ok) {
      const msg = data && data.error ? data.error : `HTTP ${res.status}`;
      throw new TestRailError(`TestRail ${method} ${endpoint} failed: ${msg}`);
    }
    return data;
  }
  throw new TestRailError(`TestRail ${method} ${endpoint} kept returning 429 (rate limited)`);
}

// Bulk endpoints return either a bare array (old TestRail) or a paginated
// object {offset, limit, size, _links: {next}, <key>: [...]}.
async function getAll(cfg, endpoint, key, query = {}, max = 5000) {
  const out = [];
  let offset = 0;
  while (out.length < max) {
    const data = await api(cfg, 'GET', endpoint, { query: { ...query, limit: 250, offset } });
    if (Array.isArray(data)) { out.push(...data); break; }
    const page = data[key] || [];
    out.push(...page);
    if (!data._links || !data._links.next || page.length === 0) break;
    offset += page.length;
  }
  return out.slice(0, max);
}

// API names of custom case fields are `custom_<system_name>`. On newer instances the system name
// of a field created as "review_status" is stored as "case_review_status", so the API key is
// custom_case_review_status. The admin screen shows the short name, which is easy to copy wrongly.
function checkConfiguredFields(cfg, fields) {
  const names = new Set(fields.map((f) => f.system_name));
  const warnings = [];
  for (const [key, conf] of [['reviewField', cfg.reviewField], ['automatedField', cfg.automatedField]]) {
    if (!conf) {
      warnings.push(`${key} is not configured in .qa/config.json.`);
      continue;
    }
    if (names.has(conf.field)) continue;
    const short = conf.field.replace(/^custom_(case_)?/, '');
    const guess = [...names].find((n) => n === `custom_case_${short}` || n === `custom_${short}`);
    warnings.push(
      `${key}.field "${conf.field}" is not a case field on this instance.` +
        (guess ? ` Use "${guess}" (from get_case_fields).` : ' Check testrail_get_meta for the system_name.')
    );
  }
  return warnings;
}

const caseId = (v) => Number(String(v).replace(/^C/i, ''));
const suiteQuery = (cfg) => (cfg.suiteId ? { suite_id: cfg.suiteId } : {});

function compactCase(cfg, c) {
  const out = {
    id: `C${c.id}`,
    title: c.title,
    section_id: c.section_id,
    priority_id: c.priority_id,
    type_id: c.type_id,
    refs: c.refs || null,
  };
  if (cfg.reviewField) {
    const v = c[cfg.reviewField.field];
    out.review = v === cfg.reviewField.approved ? 'approved' : v === cfg.reviewField.draft ? 'ai-draft' : v ?? null;
  }
  if (cfg.automatedField) out.automated = c[cfg.automatedField.field] === cfg.automatedField.value;
  return out;
}

// Case content for reviews: preconditions and steps, without the rest of the custom fields.
function detailedCase(cfg, c) {
  const out = compactCase(cfg, c);
  out.preconditions = c.custom_preconds || null;
  if (Array.isArray(c.custom_steps_separated) && c.custom_steps_separated.length) {
    out.steps = c.custom_steps_separated.map((s) => ({ content: s.content || '', expected: s.expected || '' }));
  } else if (c.custom_steps || c.custom_expected) {
    out.steps_text = c.custom_steps || '';
    out.expected_text = c.custom_expected || '';
  }
  return out;
}

// Fields that change what a case says. Rewriting any of them sends the case back to Gate 1.
const CONTENT_KEYS = ['title', 'custom_preconds', 'custom_steps_separated', 'custom_steps', 'custom_expected'];

function buildCaseBody(cfg, input) {
  const body = { title: input.title };
  if (input.priority_id) body.priority_id = input.priority_id;
  if (input.type_id) body.type_id = input.type_id;
  if (input.refs) body.refs = input.refs;
  if (input.estimate) body.estimate = input.estimate;
  if (cfg.templateId) body.template_id = cfg.templateId;
  if (input.preconditions) body.custom_preconds = input.preconditions;
  if (Array.isArray(input.steps) && input.steps.length) {
    body.custom_steps_separated = input.steps.map((s) => ({ content: s.content || '', expected: s.expected || '' }));
  }
  Object.assign(body, input.fields || {});
  if (cfg.reviewField) body[cfg.reviewField.field] = cfg.reviewField.draft;
  return body;
}

// ---------------------------------------------------------------- tools

const stepSchema = {
  type: 'object',
  properties: { content: { type: 'string' }, expected: { type: 'string' } },
  required: ['content'],
};
const newCaseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Case title, written as the behaviour under test' },
    priority_id: { type: 'integer', description: 'See testrail_get_meta for ids' },
    type_id: { type: 'integer', description: 'See testrail_get_meta for ids' },
    refs: { type: 'string', description: 'Ticket ids, comma-separated, e.g. "PROJ-142"' },
    preconditions: { type: 'string' },
    steps: { type: 'array', items: stepSchema, description: 'Separated steps: action + expected result' },
    fields: { type: 'object', description: 'Extra custom_* fields by system name' },
  },
  required: ['title'],
};

const TOOLS = [
  {
    name: 'testrail_status',
    description: 'Check the TestRail connection and show which project/suite this repo is bound to. Call first if anything fails.',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: async (cfg) => {
      const [p, fields] = await Promise.all([
        api(cfg, 'GET', `get_project/${cfg.projectId}`),
        api(cfg, 'GET', 'get_case_fields').catch(() => null),
      ]);
      const warnings = fields ? checkConfiguredFields(cfg, fields) : ['Could not read get_case_fields to verify field names.'];
      return {
        connected: true,
        url: cfg.url,
        project: { id: p.id, name: p.name, suite_mode: p.suite_mode },
        suiteId: cfg.suiteId,
        reviewField: cfg.reviewField ? cfg.reviewField.field : 'not configured',
        automatedField: cfg.automatedField ? cfg.automatedField.field : 'not configured',
        warnings,
        projectUrl: `${cfg.url}/index.php?/projects/overview/${p.id}`,
      };
    },
  },
  {
    name: 'testrail_get_meta',
    description: 'List priorities, case types, templates and custom case fields (system names and dropdown options) for this project.',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: async (cfg) => {
      const [priorities, types, fields, templates] = await Promise.all([
        api(cfg, 'GET', 'get_priorities'),
        api(cfg, 'GET', 'get_case_types'),
        api(cfg, 'GET', 'get_case_fields'),
        api(cfg, 'GET', `get_templates/${cfg.projectId}`).catch(() => []),
      ]);
      return {
        priorities: priorities.map((p) => ({ id: p.id, name: p.name, is_default: p.is_default })),
        case_types: types.map((t) => ({ id: t.id, name: t.name })),
        templates: (templates || []).map((t) => ({ id: t.id, name: t.name })),
        custom_fields: fields.filter((f) => f.is_active !== false).map((f) => ({
          system_name: f.system_name,
          label: f.label,
          type_id: f.type_id,
          options: (f.configs || [])
            .filter((c) => !c.context || c.context.is_global || (c.context.project_ids || []).includes(cfg.projectId))
            .map((c) => c.options && c.options.items)
            .filter(Boolean)[0] || undefined,
        })),
      };
    },
  },
  {
    name: 'testrail_get_sections',
    description: 'List sections (folders) in the bound project/suite.',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: async (cfg) => {
      const sections = await getAll(cfg, `get_sections/${cfg.projectId}`, 'sections', suiteQuery(cfg));
      return sections.map((s) => ({ id: s.id, name: s.name, parent_id: s.parent_id, depth: s.depth }));
    },
  },
  {
    name: 'testrail_add_section',
    description: 'Create a section (folder) for a feature. Check testrail_get_sections first to avoid duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        parent_id: { type: 'integer' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
    run: async (cfg, a) => {
      const body = { name: a.name };
      if (a.parent_id) body.parent_id = a.parent_id;
      if (a.description) body.description = a.description;
      if (cfg.suiteId) body.suite_id = cfg.suiteId;
      const s = await api(cfg, 'POST', `add_section/${cfg.projectId}`, { body });
      return { id: s.id, name: s.name, parent_id: s.parent_id };
    },
  },
  {
    name: 'testrail_get_cases',
    description: 'List cases (compact) in the project, optionally in one section or filtered by title text. Shows review state and automation flag when configured. details: true adds preconditions and steps (for reviewing a section in one call).',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: { type: 'integer' },
        filter: { type: 'string', description: 'Title contains this text' },
        priority_id: { type: 'string', description: 'Comma-separated priority ids' },
        details: { type: 'boolean', description: 'Include preconditions and steps' },
      },
    },
    readOnly: true,
    run: async (cfg, a) => {
      const cases = await getAll(cfg, `get_cases/${cfg.projectId}`, 'cases', {
        ...suiteQuery(cfg),
        section_id: a.section_id,
        filter: a.filter,
        priority_id: a.priority_id,
      });
      const shape = a.details ? detailedCase : compactCase;
      return { count: cases.length, cases: cases.map((c) => shape(cfg, c)) };
    },
  },
  {
    name: 'testrail_get_case',
    description: 'Get one case in full, including steps and custom fields. Accepts "C123" or 123.',
    inputSchema: { type: 'object', properties: { case_id: { type: ['string', 'integer'] } }, required: ['case_id'] },
    readOnly: true,
    run: async (cfg, a) => api(cfg, 'GET', `get_case/${caseId(a.case_id)}`),
  },
  {
    name: 'testrail_add_cases',
    description: 'Create one or more cases in a section in a single call. Cases are marked as AI draft for Gate 1 review when a review field is configured.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: { type: 'integer' },
        cases: { type: 'array', items: newCaseSchema, minItems: 1, maxItems: 50 },
      },
      required: ['section_id', 'cases'],
    },
    run: async (cfg, a) => {
      const created = [];
      for (const input of a.cases) {
        const c = await api(cfg, 'POST', `add_case/${a.section_id}`, { body: buildCaseBody(cfg, input) });
        created.push({ id: `C${c.id}`, title: c.title });
      }
      return {
        created,
        reviewUrl: `${cfg.url}/index.php?/suites/view/${cfg.suiteId || ''}&group_by=cases:section_id&group_id=${a.section_id}`,
        note: cfg.reviewField ? 'Marked as AI draft. A QA lead must approve them in TestRail (Gate 1).' : 'No review field configured; tell the QA lead which cases are new.',
      };
    },
  },
  {
    name: 'testrail_update_case',
    description: 'Update a case: title, preconditions, steps, priority_id, refs or custom_* fields. Rewriting the title, preconditions or steps sends the case back to AI draft for Gate 1. Cannot approve cases: approval is a human gate.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: { type: ['string', 'integer'] },
        title: { type: 'string' },
        preconditions: { type: 'string', description: 'Replaces the preconditions' },
        steps: { type: 'array', items: stepSchema, description: 'Replaces all separated steps' },
        fields: { type: 'object', description: 'Other fields to change, by API name' },
      },
      required: ['case_id'],
    },
    run: async (cfg, a) => {
      const f = { ...(a.fields || {}) };
      if (a.title) f.title = a.title;
      if (a.preconditions !== undefined) f.custom_preconds = a.preconditions;
      if (Array.isArray(a.steps)) f.custom_steps_separated = a.steps.map((s) => ({ content: s.content || '', expected: s.expected || '' }));
      if (!Object.keys(f).length) throw new TestRailError('Nothing to update: pass title, preconditions, steps or fields.');
      // Gate 1: never let the agent approve a case, whatever the review field ends up being called.
      const approved = cfg.reviewField ? cfg.reviewField.approved : 2;
      const reviewKeys = Object.keys(f).filter((k) => (cfg.reviewField && k === cfg.reviewField.field) || /review_status$/.test(k));
      if (reviewKeys.some((k) => f[k] === approved || String(f[k]).toLowerCase() === 'approved')) {
        throw new TestRailError('Refused: approving a case is Gate 1 and must be done by a person in TestRail.');
      }
      // An approved case that Claude rewrites is a new draft: a person reviews it again.
      const rewritten = Object.keys(f).some((k) => CONTENT_KEYS.includes(k));
      if (rewritten && cfg.reviewField) f[cfg.reviewField.field] = cfg.reviewField.draft;
      const c = await api(cfg, 'POST', `update_case/${caseId(a.case_id)}`, { body: f });
      const out = compactCase(cfg, c);
      if (rewritten && cfg.reviewField) out.note = 'Content changed: set back to AI draft for Gate 1.';
      return out;
    },
  },
  {
    name: 'testrail_move_cases',
    description: 'Move cases to another section of the same suite, keeping their ids, history and results. Use to retire merged or dropped cases into a "Retired" section instead of deleting them.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: { type: 'integer', description: 'Target section' },
        case_ids: { type: 'array', items: { type: ['string', 'integer'] }, minItems: 1, maxItems: 250 },
      },
      required: ['section_id', 'case_ids'],
    },
    run: async (cfg, a) => {
      const suiteId = cfg.suiteId || (await api(cfg, 'GET', `get_section/${a.section_id}`)).suite_id;
      const ids = a.case_ids.map(caseId);
      await api(cfg, 'POST', `move_cases_to_section/${a.section_id}`, { body: { suite_id: suiteId, case_ids: ids } });
      return { moved: ids.map((i) => `C${i}`), section_id: a.section_id };
    },
  },
  {
    name: 'testrail_mark_automated',
    description: 'Mark cases as automated once their Playwright test is merged or in an open PR.',
    inputSchema: {
      type: 'object',
      properties: { case_ids: { type: 'array', items: { type: ['string', 'integer'] }, minItems: 1 } },
      required: ['case_ids'],
    },
    run: async (cfg, a) => {
      if (!cfg.automatedField) return { skipped: true, reason: 'testrail.automatedField is not set in .qa/config.json' };
      const done = [];
      for (const id of a.case_ids) {
        await api(cfg, 'POST', `update_case/${caseId(id)}`, { body: { [cfg.automatedField.field]: cfg.automatedField.value } });
        done.push(`C${caseId(id)}`);
      }
      return { marked: done };
    },
  },
  {
    name: 'testrail_get_runs',
    description: 'List recent test runs for the project (newest first) with pass/fail counts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', default: 10 },
        created_after: { type: 'string', description: 'ISO date, e.g. 2026-10-01' },
        created_before: { type: 'string', description: 'ISO date' },
      },
    },
    readOnly: true,
    run: async (cfg, a) => {
      const ts = (d) => (d ? Math.floor(Date.parse(d) / 1000) : undefined);
      const runs = await getAll(cfg, `get_runs/${cfg.projectId}`, 'runs', {
        created_after: ts(a.created_after),
        created_before: ts(a.created_before),
      }, a.limit || 10);
      return runs.map((r) => ({
        id: r.id,
        name: r.name,
        created_on: new Date(r.created_on * 1000).toISOString(),
        is_completed: r.is_completed,
        passed: r.passed_count,
        failed: r.failed_count,
        blocked: r.blocked_count,
        untested: r.untested_count,
        retest: r.retest_count,
        url: r.url,
      }));
    },
  },
  {
    name: 'testrail_get_run_summary',
    description: 'Summarise one run: counts plus the failed and blocked tests with their case ids.',
    inputSchema: { type: 'object', properties: { run_id: { type: 'integer' } }, required: ['run_id'] },
    readOnly: true,
    run: async (cfg, a) => {
      const run = await api(cfg, 'GET', `get_run/${a.run_id}`);
      const tests = await getAll(cfg, `get_tests/${a.run_id}`, 'tests', { status_id: '2,5' }, 500);
      return {
        id: run.id,
        name: run.name,
        url: run.url,
        counts: { passed: run.passed_count, failed: run.failed_count, blocked: run.blocked_count, untested: run.untested_count, retest: run.retest_count },
        not_passing: tests.map((t) => ({ case_id: `C${t.case_id}`, title: t.title, status: STATUS[t.status_id] || t.status_id })),
      };
    },
  },
];

// ---------------------------------------------------------------- MCP plumbing

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case 'initialize': {
      const asked = params && params.protocolVersion;
      reply(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'TestRail tools for the QA Kit. The project is fixed by .qa/config.json. Batch case creation with testrail_add_cases. Never try to approve cases.',
      });
      return;
    }
    case 'ping':
      if (isRequest) reply(id, {});
      return;
    case 'tools/list':
      reply(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: !!t.readOnly, destructiveHint: false },
        })),
      });
      return;
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === (params && params.name));
      if (!tool) { fail(id, -32602, `Unknown tool: ${params && params.name}`); return; }
      const cfg = loadConfig();
      if (cfg.error) { reply(id, { content: [{ type: 'text', text: cfg.error }], isError: true }); return; }
      try {
        const result = await tool.run(cfg, (params && params.arguments) || {});
        reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        reply(id, { content: [{ type: 'text', text: e instanceof TestRailError ? e.message : `Error: ${e.message}` }], isError: true });
      }
      return;
    }
    default:
      if (method && method.startsWith('notifications/')) return; // no response to notifications
      if (isRequest) fail(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { fail(null, -32700, 'Parse error'); return; }
  const batch = Array.isArray(msg) ? msg : [msg];
  for (const m of batch) handle(m).catch((e) => m.id != null && fail(m.id, -32603, e.message));
});
rl.on('close', () => process.exit(0));
