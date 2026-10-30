// Today's steps/expected format. These tests prove old CSVs keep working as the kit adds Gherkin cases.
// Run: node --test plugins/qa-kit/tests

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  numbered,
  parseDecision,
  parseData,
  loadRisks,
  checkCases,
  testrailPreconditions,
  testrailSteps,
  buildPayload,
  renderScenarios,
  planToRows,
} from "../templates/.qa/scripts/cases.mjs";
import { readRecords, writeCsv } from "../templates/.qa/scripts/lib/csv.mjs";

const LEGACY_COLUMNS = [
  "key",
  "testrail_id",
  "section",
  "title",
  "priority",
  "type",
  "risks",
  "why_it_matters",
  "preconditions",
  "steps",
  "expected",
  "data",
  "notes",
  "known_issue",
  "source",
  "file",
  "suggestion",
  "decision",
  "review_notes",
];

const row = (over = {}, n = 2) => ({
  _row: n,
  key: "PO-01",
  testrail_id: "",
  section: "Approve",
  title: "Approving a purchase adds stock",
  priority: "P1",
  type: "Functional",
  risks: "1",
  why_it_matters: "Stock would be wrong",
  preconditions: "Purchase P is pending",
  steps: "1. Approve P\n2. Open stock",
  expected: "1. P is APPROVED\n2. Stock is 5 higher",
  data: "",
  notes: "",
  known_issue: "",
  source: "",
  file: "",
  suggestion: "Keep",
  decision: "Keep",
  review_notes: "",
  ...over,
});

const check = (rows, opts = {}) => checkCases(rows, { risks: [], glossary: null, ...opts }, LEGACY_COLUMNS);

test("numbered splits numbered lines and joins continuations", () => {
  assert.deepEqual(numbered("1. do this\n   more\n2) then that"), {
    items: ["do this\nmore", "then that"],
    nums: [1, 2],
  });
  assert.deepEqual(numbered(""), { items: [], nums: [] });
});

test("parseDecision reads the review grammar", () => {
  assert.deepEqual(parseDecision(""), { kind: "" });
  assert.equal(parseDecision("keep").kind, "keep");
  assert.deepEqual(parseDecision("Merge into po-04: same check"), {
    kind: "merge",
    target: "PO-04",
    reason: "same check",
  });
  assert.equal(parseDecision("maybe").kind, "invalid");
});

test("parseData reads a pipe table", () => {
  assert.deepEqual(parseData("qty | result\n0 | refused\n5 | ok"), {
    header: ["qty", "result"],
    rows: [
      ["0", "refused"],
      ["5", "ok"],
    ],
  });
  assert.equal(parseData(""), null);
});

test("loadRisks reads the ranked list from business-context.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-"));
  mkdirSync(join(dir, ".qa"));
  writeFileSync(
    join(dir, ".qa", "business-context.md"),
    "# Context\n\n## What must never go wrong\n\n1. **Stock is never wrong.** More text\n2. Money is never lost.\n\n## Other\n\n3. not a risk\n"
  );
  assert.deepEqual(loadRisks(dir), [
    { rank: 1, title: "Stock is never wrong" },
    { rank: 2, title: "Money is never lost" },
  ]);
});

test("a valid legacy row passes check", () => {
  const res = check([row()]);
  assert.deepEqual(res.errors, []);
  assert.equal(res.summary.live, 1);
  assert.equal(res.summary.keep, 1);
});

test("check reports bad keys, priorities, numbering and step counts", () => {
  const res = check([
    row({ key: "po1", priority: "High" }),
    row({ key: "PO-02", steps: "1. a\n3. b", expected: "1. x" }, 3),
  ]);
  const text = res.errors.join("\n");
  assert.match(text, /key "po1" should look like PO-01/);
  assert.match(text, /priority "High"/);
  assert.match(text, /steps should be numbered/);
  assert.match(text, /2 steps but 1 expected results/);
});

test("check needs steps when there is no scenario", () => {
  const res = check([row({ steps: "", expected: "" })]);
  assert.ok(res.errors.some((e) => /steps is empty|scenario is empty/.test(e)));
});

test("check --push refuses undecided and Rewrite rows", () => {
  const res = check([row({ decision: "" }), row({ key: "PO-02", decision: "Rewrite" }, 3)], { push: true });
  assert.equal(res.errors.length, 2);
});

test("merge targets must exist and be live", () => {
  const res = check([row({ decision: "Merge into PO-09" }), row({ key: "PO-02", decision: "Merge into PO-02" }, 3)]);
  assert.match(res.errors.join("\n"), /PO-09, which isn't in the file/);
  assert.match(res.errors.join("\n"), /merges into PO-02, which is itself dropped or merged/);
});

test("risk coverage and unknown risk ranks", () => {
  const risks = [
    { rank: 1, title: "Stock" },
    { rank: 2, title: "Money" },
  ];
  const res = check([row({ risks: "1;3" })], { risks });
  assert.match(res.errors.join("\n"), /risks 3 not in/);
  assert.deepEqual(
    res.coverage.map((c) => c.cases),
    [["PO-01"], []]
  );
});

test("legacy TestRail text: preconditions plus why, one step per numbered step, data in step 1", () => {
  const r = row({ data: "qty | ok\n1 | yes" });
  assert.equal(testrailPreconditions(r), "Purchase P is pending\n\nWhy it matters: Stock would be wrong");
  assert.deepEqual(testrailSteps(r), [
    { content: "Approve P\n\n| qty | ok |\n| --- | --- |\n| 1 | yes |", expected: "P is APPROVED" },
    { content: "Open stock", expected: "Stock is 5 higher" },
  ]);
});

test("payload splits create, update, retire and held back", () => {
  const p = buildPayload([
    row(),
    row({ key: "PO-02", testrail_id: "C2" }),
    row({ key: "PO-03", testrail_id: "C3", decision: "Drop: duplicate" }),
    row({ key: "PO-04", decision: "" }),
  ]);
  assert.deepEqual(
    p.create.map((c) => c.key),
    ["PO-01"]
  );
  assert.deepEqual(
    p.update.map((c) => c.key),
    ["PO-02"]
  );
  assert.deepEqual(p.retire, [{ key: "PO-03", testrail_id: "C3", decision: "Drop: duplicate" }]);
  assert.deepEqual(p.held_back, [{ key: "PO-04", decision: "(not reviewed)" }]);
});

test("renderScenarios writes numbered steps with expect lines", () => {
  const md = renderScenarios([row()]);
  assert.match(md, /### 1\. Approve/);
  assert.match(md, /#### 1\.1\. Approving a purchase adds stock/);
  assert.match(md, /1\. Approve P\n {3}- expect: P is APPROVED/);
});

test("CSV round trip keeps quotes, commas and newlines", () => {
  const text = writeCsv(["a", "b"], [{ a: 'say "hi", ok', b: "line1\nline2" }]);
  const { columns, records } = readRecords(text);
  assert.deepEqual(columns, ["a", "b"]);
  assert.equal(records[0].a, 'say "hi", ok');
  assert.equal(records[0].b, "line1\nline2");
});

test("legacy fixture file passes check", () => {
  const text = readFileSync(new URL("./fixtures/legacy.csv", import.meta.url), "utf8");
  const { columns, records } = readRecords(text);
  const res = checkCases(records, { risks: [], glossary: null }, columns);
  assert.deepEqual(res.errors, []);
});

test("from-plan reads a legacy Markdown plan", () => {
  const plan = [
    "## Test Scenarios",
    "",
    "### 1. Approve",
    "",
    "#### 1.1. Approving adds stock",
    "",
    "**TestRail:** C12 · **Key:** PO-01 · **Priority:** P1",
    "",
    "**Preconditions:** Purchase P is pending",
    "",
    "**Steps:**",
    "",
    "1. Approve P",
    "   - expect: P is APPROVED",
  ].join("\n");
  const [r] = planToRows(plan, "PO");
  assert.equal(r.key, "PO-01");
  assert.equal(r.testrail_id, "C12");
  assert.equal(r.priority, "P1");
  assert.equal(r.section, "Approve");
  assert.equal(r.preconditions, "Purchase P is pending");
});
