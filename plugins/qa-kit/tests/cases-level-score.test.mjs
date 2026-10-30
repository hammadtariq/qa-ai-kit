// Test level per case, independent scores and the case budget by risk tier.
// Run: node --test plugins/qa-kit/tests

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COLUMNS,
  checkCases,
  buildPayload,
  renderScenarios,
  planToRows,
  parseScore,
  applyScores,
  loadBudget,
} from "../templates/.qa/scripts/cases.mjs";

let n = 0;
const row = (over = {}) => ({
  _row: ++n + 1,
  key: `RF-${String(n).padStart(2, "0")}`,
  testrail_id: "",
  section: "Refunds",
  title: "A refund can never be more than the customer paid",
  priority: "P2",
  type: "Functional",
  level: "",
  risks: "",
  score: "",
  why_it_matters: "The store pays out money it never took",
  background: "",
  scenario: "Given Ali paid 5,000\nWhen the manager refunds 6,000\nThen the refund is refused",
  data: "",
  notes: "",
  suggestion: "Keep",
  decision: "Keep",
  ...over,
});
const check = (rows, opts = {}) => checkCases(rows, { risks: [], glossary: null, ...opts }, COLUMNS);
const text = (res) => [...res.errors, ...res.warnings].join("\n");

test("COLUMNS has level and score", () => {
  assert.ok(COLUMNS.includes("level"));
  assert.ok(COLUMNS.includes("score"));
});

test("level must be ui, api or unit; empty means ui", () => {
  assert.deepEqual(check([row({ level: "" }), row({ level: "api" }), row({ level: "Unit" })]).errors, []);
  assert.match(check([row({ level: "e2e" })]).errors.join(), /level "e2e" should be ui, api or unit/);
});

test("a ui case with a data table over 5 rows warns", () => {
  const data = ["amount | message", ...[0, -1, -2, 1.5, 2.5, 99999].map((v) => `${v} | no`)].join("\n");
  const scenario = "Given Omar is receiving D-3\nWhen Omar enters <amount>\nThen Omar sees <message>";
  assert.match(text(check([row({ scenario, data })])), /6 data rows.*api/);
  assert.doesNotMatch(text(check([row({ scenario, data, level: "api" })])), /data rows/);
});

test("a ui case with a long data table still gets the bad-row error", () => {
  const data = ["amount | message", ...[0, -1, -2, 1.5, 2.5].map((v) => `${v} | no`), "99999"].join("\n");
  const scenario = "Given Omar is receiving D-3\nWhen Omar enters <amount>\nThen Omar sees <message>";
  const res = check([row({ scenario, data })]);
  assert.match(res.errors.join(), /data row 6 has 1 cells, header has 2/);
  assert.match(res.warnings.join(), /6 data rows/);
});

test("parseScore reads impact x likelihood", () => {
  assert.deepEqual(parseScore("3x2"), { impact: 3, likelihood: 2, value: 6 });
  assert.deepEqual(parseScore(" 1 × 3 "), { impact: 1, likelihood: 3, value: 3 });
  assert.equal(parseScore(""), null);
  assert.equal(parseScore("4x1").invalid, true);
});

test("check validates score and warns on a P1 without impact 3", () => {
  assert.match(check([row({ score: "high" })]).errors.join(), /score "high"/);
  assert.match(check([row({ priority: "P1", score: "2x3" })]).warnings.join(), /P1 needs impact 3/);
  assert.doesNotMatch(check([row({ priority: "P1", score: "3x1" })]).warnings.join(), /P1 needs/);
});

test("budget by tier: warns above it and names the lowest-scoring rows", () => {
  const rows = [
    row({ score: "3x3" }),
    row({ score: "1x3", key: "LOW-1" }),
    row({ score: "3x2" }),
    row({ score: "2x1", key: "LOW-2" }),
    row({ level: "unit" }), // unit rows don't count against the E2E budget
  ];
  const budget = { low: 2, medium: 3, high: 6 };
  const w = check(rows, { tier: "low", budget }).warnings.join("\n");
  assert.match(w, /4 live cases; the low budget is 2/);
  assert.match(w, /LOW-2 \(2x1\), LOW-1 \(1x3\)/);
  assert.doesNotMatch(check(rows, { tier: "high", budget }).warnings.join(), /budget/);
  assert.match(check(rows, { tier: "huge", budget }).errors.join(), /tier "huge"/);
});

test("without a tier the medium budget applies", () => {
  const rows = Array.from({ length: 13 }, () => row());
  assert.match(check(rows).warnings.join(), /13 live cases; the medium budget is 12/);
});

test("loadBudget reads .qa/config.json cases.budget over the defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-"));
  assert.deepEqual(loadBudget(dir), { low: 6, medium: 12, high: 20 });
  mkdirSync(join(dir, ".qa"));
  writeFileSync(join(dir, ".qa", "config.json"), JSON.stringify({ cases: { budget: { high: 30 } } }));
  assert.deepEqual(loadBudget(dir), { low: 6, medium: 12, high: 30 });
});

test("unit rows are not pushed; already-pushed ones retire; both are listed for developers", () => {
  const p = buildPayload([
    row({ key: "RF-01" }),
    row({ key: "RF-02", level: "unit" }),
    row({ key: "RF-03", level: "unit", testrail_id: "C3" }),
    row({ key: "RF-04", level: "api", testrail_id: "C4" }),
  ]);
  assert.deepEqual(
    p.create.map((c) => c.key),
    ["RF-01"]
  );
  assert.deepEqual(
    p.update.map((c) => c.key),
    ["RF-04"]
  );
  assert.deepEqual(p.retire, [{ key: "RF-03", testrail_id: "C3", decision: "Keep (unit level: a developer test now)" }]);
  assert.deepEqual(
    p.for_developers.map((c) => c.key),
    ["RF-02", "RF-03"]
  );
});

test("the plan lists unit rows under For developers and shows level and score", () => {
  const md = renderScenarios([
    row({ key: "RF-01", score: "3x2", level: "api" }),
    row({ key: "RF-02", level: "unit", title: "Tax rounds half up" }),
  ]);
  assert.match(md, /### 1\. Refunds/);
  assert.match(md, /\*\*Level:\*\* api/);
  assert.match(md, /\*\*Score:\*\* 3x2/);
  assert.match(md, /### For developers\n/);
  assert.ok(md.indexOf("Tax rounds half up") > md.indexOf("### For developers"));
  const rows = planToRows("## Test Scenarios\n\n" + md, "RF");
  assert.deepEqual(
    rows.map((r) => [r.key, r.level || "", r.score || "", r.section]),
    [
      ["RF-01", "api", "3x2", "Refunds"],
      ["RF-02", "unit", "", "Refunds"],
    ]
  );
});

test("applyScores writes score and suggests Merge, Drop or Rewrite, never touching decision", () => {
  const rows = [
    row({ key: "A-01", decision: "" }),
    row({ key: "A-02", decision: "Keep" }),
    row({ key: "A-03" }),
    row({ key: "A-04" }),
    row({ key: "A-05", priority: "P1" }),
    row({ key: "A-06", suggestion: "" }),
  ];
  const scores = [
    { key: "A-01", impact: 3, likelihood: 3, unique: true, observable: true },
    { key: "A-02", impact: 3, likelihood: 2, unique: false, duplicate_of: "A-01", observable: true, reason: "same refund cap" },
    { key: "A-03", impact: 2, likelihood: 1, unique: true, observable: true, reason: "needs an unusual input" },
    { key: "A-04", impact: 3, likelihood: 2, unique: true, observable: false, reason: "Then can't be seen" },
    { key: "A-05", impact: 2, likelihood: 3, unique: true, observable: true },
    { key: "A-06", impact: 2, likelihood: 2, unique: true, observable: true },
  ];
  const res = applyScores(rows, scores);
  assert.deepEqual(res.errors, []);
  const by = Object.fromEntries(res.rows.map((r) => [r.key, r]));
  assert.equal(by["A-01"].score, "3x3");
  assert.equal(by["A-01"].suggestion, "Keep");
  assert.equal(by["A-02"].suggestion, "Merge into A-01: same refund cap");
  assert.equal(by["A-02"].decision, "Keep");
  assert.equal(by["A-03"].suggestion, "Drop: score 2x1 under 3; needs an unusual input");
  assert.equal(by["A-04"].suggestion, "Rewrite: not observable; Then can't be seen");
  assert.equal(by["A-05"].suggestion, "Rewrite: P1 needs impact 3, scored 2x3; make it P2 or show the bigger loss");
  assert.equal(by["A-06"].suggestion, "Keep");
  assert.equal(res.changes.length, 4);
});

test("applyScores drops impact 1 whatever the likelihood, unless the owner asked for it", () => {
  const rows = [row({ key: "C-01" }), row({ key: "C-02" }), row({ key: "C-03" })];
  const res = applyScores(rows, [
    { key: "C-01", impact: 1, likelihood: 3, unique: true, observable: true, reason: "only the dialog title" },
    { key: "C-02", impact: 1, likelihood: 3, unique: true, observable: true, owner_asked: true },
    { key: "C-03", impact: 1, likelihood: 3, unique: false, duplicate_of: "C-02", observable: true },
  ]);
  const by = Object.fromEntries(res.rows.map((r) => [r.key, r.suggestion]));
  assert.equal(by["C-01"], "Drop: impact 1 (cosmetic or convenience); only the dialog title");
  assert.equal(by["C-02"], "Keep");
  assert.equal(by["C-03"], "Merge into C-02");
});

test("applyScores warns when a Drop, Merge or Rewrite comes without the reviewer's reason", () => {
  const rows = [row({ key: "D-01" }), row({ key: "D-02" }), row({ key: "D-03", priority: "P1" }), row({ key: "D-04" })];
  const res = applyScores(rows, [
    { key: "D-01", impact: 3, likelihood: 2, unique: false, duplicate_of: "D-04", observable: true },
    { key: "D-02", impact: 2, likelihood: 1, unique: true, observable: true, reason: "needs an unusual input" },
    { key: "D-03", impact: 2, likelihood: 3, unique: true, observable: true },
    { key: "D-04", impact: 3, likelihood: 3, unique: true, observable: true },
  ]);
  assert.deepEqual(res.errors, []);
  assert.equal(res.warnings.length, 1);
  assert.match(res.warnings[0], /^D-01: "Merge into D-04" has no reason/);
});

test("applyScores rejects unknown keys, bad numbers and bad merge targets", () => {
  const res = applyScores(
    [row({ key: "B-01" })],
    [
      { key: "B-09", impact: 3, likelihood: 3, unique: true, observable: true },
      { key: "B-01", impact: 4, likelihood: 1, unique: false, duplicate_of: "B-01", observable: true },
    ]
  );
  const e = res.errors.join("\n");
  assert.match(e, /B-09 isn't in the file/);
  assert.match(e, /B-01: impact and likelihood must be 1, 2 or 3/);
});
