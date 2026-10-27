// Gherkin cases: the scenario and background columns, their TestRail mapping, the writing checks and migrate.
// Run: node --test plugins/qa-kit/tests

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COLUMNS,
  parseScenario,
  checkCases,
  testrailPreconditions,
  testrailSteps,
  buildPayload,
  renderScenarios,
  planToRows,
  toScenario,
  migrateRows,
  loadGlossary,
  loadRisks,
} from "../templates/.qa/scripts/cases.mjs";

const SCENARIO = [
  "Given Ali paid 5,000 for order A-17",
  "When the store manager refunds 6,000",
  'Then the refund is refused with "Refund is more than the amount paid"',
  "And order A-17 still shows 5,000 paid and nothing refunded",
].join("\n");

const row = (over = {}, n = 2) => ({
  _row: n,
  key: "RF-01",
  testrail_id: "",
  section: "Refunds",
  title: "A refund can never be more than the customer paid",
  priority: "P1",
  type: "Functional",
  risks: "",
  why_it_matters: "The store pays out money it never took",
  background: "",
  scenario: SCENARIO,
  preconditions: "",
  steps: "",
  expected: "",
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

const check = (rows, opts = {}) => checkCases(rows, { risks: [], glossary: null, ...opts }, COLUMNS);
const errorsOf = (r, opts) => check([row(r)], opts).errors.join("\n");
const warningsOf = (r, opts) => check([row(r)], opts).warnings.join("\n");

test("COLUMNS has scenario and background before the legacy columns", () => {
  assert.ok(COLUMNS.indexOf("background") < COLUMNS.indexOf("scenario"));
  assert.ok(COLUMNS.indexOf("scenario") < COLUMNS.indexOf("preconditions"));
});

test("parseScenario groups Given lines and When/Then pairs, And/But joining the block above", () => {
  const s = parseScenario(
    "Given A\nAnd B\nWhen C\nAnd D\nThen E\nBut F\nWhen G\nThen H"
  );
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.given, ["Given A", "And B"]);
  assert.deepEqual(s.pairs, [
    { when: ["When C", "And D"], then: ["Then E", "But F"] },
    { when: ["When G"], then: ["Then H"] },
  ]);
  assert.equal(s.lines.length, 8);
});

test("parseScenario normalises keyword case and indentation", () => {
  const s = parseScenario("  given A\n    and B\nwhen C\nTHEN D");
  assert.deepEqual(s.given, ["Given A", "And B"]);
  assert.deepEqual(s.pairs, [{ when: ["When C"], then: ["Then D"] }]);
});

test("parseScenario reports structure errors", () => {
  assert.match(parseScenario("When A\nThen B").errors.join(), /start with Given/);
  assert.match(parseScenario("Given A\nWhen B").errors.join(), /When .* no Then/);
  assert.match(parseScenario("Given A\nThen B").errors.join(), /Then .* no When/);
  assert.match(parseScenario("Given A\nclick it\nWhen B\nThen C").errors.join(), /line 2 .*Given, When, Then, And or But/);
  assert.match(parseScenario("And A\nWhen B\nThen C").errors.join(), /start with Given/);
});

test("a background supplies the Given, so the scenario may start with When", () => {
  const s = parseScenario("When A\nThen B", "Given the store has one manager");
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.given, ["Given the store has one manager"]);
});

test("a valid scenario row passes check with no warnings", () => {
  const res = check([row()]);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.warnings, []);
});

test("check accepts a file with scenario but no steps/expected columns", () => {
  const cols = COLUMNS.filter((c) => !["preconditions", "steps", "expected"].includes(c));
  const res = checkCases([row()], { risks: [], glossary: null }, cols);
  assert.deepEqual(res.errors, []);
});

test("check needs scenario or steps+expected columns", () => {
  const cols = ["key", "title", "priority", "decision"];
  const res = checkCases([row()], { risks: [], glossary: null }, cols);
  assert.match(res.errors.join(), /scenario/);
});

test("an empty row (no scenario, no steps) is an error", () => {
  assert.match(errorsOf({ scenario: "" }), /scenario is empty/);
});

test("steps next to a scenario are ignored, with a warning", () => {
  assert.match(warningsOf({ steps: "1. a", expected: "1. b" }), /ignored/);
});

test("technical words are errors, borderline words warnings, in title and scenario only", () => {
  const e = errorsOf({
    scenario: "Given Ali is signed in\nWhen Ali clicks the Save button\nThen the order shows SAVED",
  });
  assert.match(e, /"click"/);
  assert.match(e, /"button"/);
  assert.match(errorsOf({ title: "Status code 403 for staff" }), /"status code"/);
  assert.match(warningsOf({ title: "The refund page shows the total" }), /"page"/);
  assert.equal(errorsOf({ notes: "click #save, endpoint POST /refunds" }), "");
});

test("words inside quotes are the app's own text and aren't checked", () => {
  const e = errorsOf({
    scenario: 'Given Ali has a failed order\nWhen Ali retries the order\nThen Ali sees "Click here to try again"',
  });
  assert.equal(e, "");
});

test("vague or unobservable Then lines warn", () => {
  const w = warningsOf({ scenario: "Given Ali has an order\nWhen Ali adds a coupon\nThen the total is correct" });
  assert.match(w, /Then .*correct/);
  const w2 = warningsOf({ scenario: "Given Ali has an order\nWhen Ali adds a coupon\nThen the discount is applied" });
  assert.match(w2, /something a person can see/);
  assert.equal(
    warningsOf({ scenario: "Given Sara is staff\nWhen Sara opens refunds\nThen Sara cannot see the refund option" }),
    ""
  );
  assert.equal(warningsOf({ scenario: "Given Ali has an order\nWhen Ali pays\nThen the order is PAID" }), "");
});

test("length checks: title words, scenario lines and When/Then pairs", () => {
  assert.match(
    warningsOf({ title: "One two three four five six seven eight nine ten eleven twelve thirteen" }),
    /13 words/
  );
  const long = ["Given A has 1", "And B has 2", "And C has 3", "When D pays 4", "Then E shows 5", "And F shows 6", "And G shows 7", "And H shows 8"].join("\n");
  assert.match(warningsOf({ scenario: long }), /8 lines/);
  const pairs = ["Given Ali has 1 order", ...[1, 2, 3, 4, 5].flatMap((i) => [`When Ali pays ${i}`, `Then the total is ${i}`])].join("\n");
  assert.match(errorsOf({ scenario: pairs }), /5 When\/Then pairs/);
});

test("placeholders must match the data header", () => {
  const scenario = "Given Ali has an order\nWhen Ali enters <qty>\nThen Ali sees <message>";
  assert.equal(errorsOf({ scenario, data: "qty | message\n0 | \"At least 1\"" }), "");
  assert.match(errorsOf({ scenario, data: "qty\n0" }), /<message>/);
  assert.match(errorsOf({ scenario }), /no data table/);
  assert.match(errorsOf({ scenario, data: "  \n " }), /no data table/);
  assert.equal(errorsOf({ data: "  \n " }), "");
});

test("a When with no Then is an error, without a warning about an undefined Then", () => {
  const res = check([row({ scenario: "Given Ali has an order\nWhen Ali pays" })]);
  assert.ok(res.errors.length);
  assert.doesNotMatch([...res.errors, ...res.warnings].join("\n"), /undefined/);
});

test("glossary: avoided words warn with the preferred term, unknown capitalised nouns warn", () => {
  const glossary = {
    terms: new Set(["order", "store", "manager", "ali", "refund"]),
    avoid: [{ word: "transaction record", use: "order" }],
  };
  const w = warningsOf(
    { scenario: "Given Ali has a transaction record\nWhen the Manager refunds it\nThen the Ledger shows 0" },
    { glossary }
  );
  assert.match(w, /"transaction record".*order/);
  assert.match(w, /"Ledger"/);
  assert.doesNotMatch(w, /"Manager"/);
  assert.doesNotMatch(w, /"Ali"/);
});

test("loadGlossary reads the table and the names list", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-"));
  mkdirSync(join(dir, ".qa"));
  writeFileSync(
    join(dir, ".qa", "glossary.md"),
    [
      "# Glossary",
      "",
      "| Term | Meaning | Say this, not |",
      "| --- | --- | --- |",
      "| Order | What a customer buys in one checkout | transaction record, purchase entry |",
      "| Store manager | Runs one store | admin |",
      "",
      "## Names used in examples",
      "",
      "- Ali: a customer",
      "- Sara: store staff",
    ].join("\n")
  );
  const g = loadGlossary(dir);
  for (const t of ["order", "store", "manager", "ali", "sara"]) assert.ok(g.terms.has(t), t);
  assert.deepEqual(g.avoid, [
    { word: "transaction record", use: "Order" },
    { word: "purchase entry", use: "Order" },
    { word: "admin", use: "Store manager" },
  ]);
  assert.equal(loadGlossary(join(dir, "nope")), null);
});

test("the untouched glossary template turns the glossary checks off", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-"));
  mkdirSync(join(dir, ".qa"));
  writeFileSync(
    join(dir, ".qa", "glossary.md"),
    readFileSync(new URL("../templates/.qa/glossary.md", import.meta.url), "utf8")
  );
  const g = loadGlossary(dir);
  assert.equal(g.terms.size, 0);
  assert.deepEqual(g.avoid, []);
  assert.equal(warningsOf({}, { glossary: g }), "");
});

test("loadRisks strips the source tag from risk titles", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-"));
  mkdirSync(join(dir, ".qa"));
  writeFileSync(
    join(dir, ".qa", "business-context.md"),
    "## What must never go wrong\n\n1. **A refund never exceeds what was paid** (owner, 2026-10-27)\n2. Stock is never negative (code: src/stock.ts)\n3. Data stays private (assumed)\n"
  );
  assert.deepEqual(
    loadRisks(dir).map((r) => r.title),
    ["A refund never exceeds what was paid", "Stock is never negative", "Data stays private"]
  );
});

test("TestRail mapping: Given lines are preconditions, each When block a step, its Then block the expected result", () => {
  const r = row({
    background: "Given the store sells in PKR",
    scenario: "Given Ali paid 5,000\nWhen the manager refunds 2,000\nThen the order shows 2,000 refunded\nWhen the manager refunds 4,000\nAnd confirms\nThen the refund is refused",
    data: "",
  });
  assert.equal(
    testrailPreconditions(r),
    "Given the store sells in PKR\nAnd Ali paid 5,000\n\nWhy it matters: The store pays out money it never took"
  );
  assert.deepEqual(testrailSteps(r), [
    { content: "When the manager refunds 2,000", expected: "Then the order shows 2,000 refunded" },
    { content: "When the manager refunds 4,000\nAnd confirms", expected: "Then the refund is refused" },
  ]);
});

test("TestRail mapping puts the Examples table in step 1", () => {
  const r = row({ scenario: "Given Ali has an order\nWhen Ali enters <qty>\nThen Ali sees <msg>", data: "qty | msg\n0 | no" });
  assert.equal(testrailSteps(r)[0].content, "When Ali enters <qty>\n\n| qty | msg |\n| --- | --- |\n| 0 | no |");
});

test("payload carries scenario-based text", () => {
  const p = buildPayload([row()]);
  assert.equal(p.create[0].steps.length, 1);
  assert.match(p.create[0].preconditions, /^Given Ali paid 5,000/);
});

test("renderScenarios writes a gherkin block, and a shared background once per section", () => {
  const md = renderScenarios([
    row({ background: "Given the store sells in PKR" }),
    row({ key: "RF-02", title: "Second", background: "Given the store sells in PKR" }, 3),
  ]);
  assert.equal(md.match(/sells in PKR/g).length, 1);
  assert.match(md, /\*\*Background:\*\*\n\n```gherkin\nGiven the store sells in PKR\n```/);
  assert.match(md, /```gherkin\nGiven Ali paid 5,000 for order A-17\nWhen the store manager refunds 6,000\nThen /);
  assert.match(md, /\n {2}And order A-17 still shows/);
});

test("a rendered scenario plan reads back into rows (from-plan round trip)", () => {
  const md = "## Test Scenarios\n\n" + renderScenarios([row({ testrail_id: "C9" })]);
  const [r] = planToRows(md, "RF");
  assert.equal(r.key, "RF-01");
  assert.equal(r.testrail_id, "C9");
  assert.equal(r.scenario, SCENARIO);
  assert.equal(r.steps, undefined);
});

test("toScenario converts preconditions, steps and expected", () => {
  const s = toScenario({
    preconditions: "Purchase P is pending\nSigned in as manager",
    steps: "1. Approve P\n2. Open the stock report",
    expected: "1. P shows APPROVED; balance + 500\n2. Stock is 5 higher",
  });
  assert.equal(
    s,
    [
      "Given Purchase P is pending",
      "And Signed in as manager",
      "When Approve P",
      "Then P shows APPROVED",
      "And balance + 500",
      "When Open the stock report",
      "Then Stock is 5 higher",
    ].join("\n")
  );
});

test("migrateRows converts legacy rows only, flags them, keeps ids and decisions", () => {
  const legacy = {
    ...row({ key: "PO-01", testrail_id: "C1", decision: "Keep", scenario: "" }),
    preconditions: "P is pending",
    steps: "1. Approve P",
    expected: "1. P shows APPROVED",
  };
  const already = row({ key: "PO-02", suggestion: "Keep" });
  const { rows, converted } = migrateRows([legacy, already]);
  assert.deepEqual(converted, ["PO-01"]);
  assert.equal(rows[0].scenario, "Given P is pending\nWhen Approve P\nThen P shows APPROVED");
  assert.equal(rows[0].steps, "");
  assert.equal(rows[0].expected, "");
  assert.equal(rows[0].preconditions, "");
  assert.equal(rows[0].testrail_id, "C1");
  assert.equal(rows[0].decision, "Keep");
  assert.equal(rows[0].suggestion, "Rewrite: converted to Given/When/Then, check the wording");
  assert.equal(rows[1].suggestion, "Keep");
});

test("a migrated row keeps the same TestRail step count and id", () => {
  const legacy = {
    ...row({ testrail_id: "C1", scenario: "" }),
    preconditions: "P is pending",
    steps: "1. Approve P\n2. Open stock",
    expected: "1. APPROVED\n2. Stock is 5 higher",
  };
  const before = buildPayload([legacy]).update[0];
  const after = buildPayload(migrateRows([legacy]).rows).update[0];
  assert.equal(after.testrail_id, before.testrail_id);
  assert.equal(after.steps.length, before.steps.length);
  assert.equal(after.title, before.title);
});
