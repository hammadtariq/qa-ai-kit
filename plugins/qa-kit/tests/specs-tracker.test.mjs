// Case ids in specs (TestRail ids or CSV keys) and the tracker setting, through lint-specs and collect-test-ids.
// Run: node --test 'plugins/qa-kit/tests/*.test.mjs'

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseSpec, trackerOf } from "../templates/.qa/scripts/lib/specs.mjs";

const SCRIPTS = resolve(import.meta.dirname, "../templates/.qa/scripts");

const SPEC = `import { test, expect, tr } from '../fixtures';
test('refund over the amount paid is refused', { annotation: tr('C12') }, async ({ page }) => { expect(1).toBe(1); });
test('staff cannot refund', { annotation: tr('rf-05'), tag: '@smoke' }, async ({ page }) => { expect(1).toBe(1); });
test('two cases', { annotation: tr('C3', 4) }, async ({ page }) => { expect(1).toBe(1); });
test('no id at all', async ({ page }) => { expect(1).toBe(1); });
`;

function project(config) {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-tracker-"));
  mkdirSync(join(dir, ".qa"));
  mkdirSync(join(dir, "e2e", "refunds"), { recursive: true });
  writeFileSync(join(dir, ".qa", "config.json"), JSON.stringify({ testDir: "e2e", ...config }));
  writeFileSync(join(dir, "e2e", "refunds", "refunds.spec.ts"), SPEC);
  return dir;
}
const lint = (dir) => spawnSync("node", [join(SCRIPTS, "lint-specs.mjs"), "--json"], { cwd: dir, encoding: "utf8" });

test("parseSpec reads TestRail ids and CSV keys, normalised like tr()", () => {
  const dir = project({});
  const ids = parseSpec(join(dir, "e2e", "refunds", "refunds.spec.ts")).map((t) => t.caseIds);
  assert.deepEqual(ids, [["C12"], ["RF-05"], ["C3", "C4"], []]);
});

test("trackerOf: the setting wins, else TestRail when a project id is set, else none", () => {
  assert.equal(trackerOf({ tracker: "none", testrail: { projectId: 3 } }), "none");
  assert.equal(trackerOf({ tracker: "testrail" }), "testrail");
  assert.equal(trackerOf({ tracker: null, testrail: { projectId: 3 } }), "testrail");
  assert.equal(trackerOf({ testrail: { projectId: 0 } }), "none");
  assert.equal(trackerOf({}), "none");
});

test("lint-specs with TestRail: a missing id is an error, a CSV key a warning", () => {
  const res = lint(project({ testrail: { projectId: 3 } }));
  const out = JSON.parse(res.stdout);
  assert.equal(res.status, 1);
  const msgs = out.findings.map((f) => `${f.level} ${f.message}`).join("\n");
  assert.match(msgs, /error "no id at all" has no TestRail id/);
  assert.match(msgs, /warn "staff cannot refund" links to RF-05, a CSV key/);
});

test("lint-specs without a tracker: keys are fine, a missing key is an error", () => {
  const out = JSON.parse(lint(project({ tracker: "none" })).stdout);
  const msgs = out.findings.map((f) => `${f.level} ${f.message}`).join("\n");
  assert.match(msgs, /error "no id at all" has no case key/);
  assert.doesNotMatch(msgs, /CSV key/);
});

test("collect-test-ids lists keys and ids together, sorted, with the tracker", () => {
  const out = JSON.parse(execFileSync("node", [join(SCRIPTS, "collect-test-ids.mjs")], { cwd: project({ tracker: "none" }), encoding: "utf8" }));
  assert.equal(out.tracker, "none");
  assert.deepEqual(out.caseIds, ["C3", "C4", "C12", "RF-05"]);
});
