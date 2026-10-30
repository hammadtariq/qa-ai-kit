// Areas: path globs, which areas a PR touches, the --grep it gets, and lint-specs' area and @a11y rules.
// Run: node --test 'plugins/qa-kit/tests/*.test.mjs'

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { validatedAreas, globToRegExp, touchedAreas, grepFor } from "../templates/.qa/scripts/lib/areas.mjs";

const SCRIPTS = resolve(import.meta.dirname, "../templates/.qa/scripts");
const AREAS = { purchases: ["src/purchases/**", "app/api/purchases/*.rb"], billing: ["src/billing"] };

test("globToRegExp: ** spans folders, * stays in one, a plain path covers what's below it", () => {
  assert.ok(globToRegExp("src/purchases/**").test("src/purchases/a/b.ts"));
  assert.ok(globToRegExp("src/**/*.ts").test("src/x.ts"));
  assert.ok(globToRegExp("src/**/*.ts").test("src/a/b/x.ts"));
  assert.ok(!globToRegExp("app/api/purchases/*.rb").test("app/api/purchases/v2/x.rb"));
  assert.ok(globToRegExp("./src/billing").test("src/billing/invoice.ts"));
  assert.ok(!globToRegExp("src/billing").test("src/billing-old/x.ts"));
  assert.ok(!globToRegExp("src/a.ts").test("src/aXts"));
});

test("globToRegExp: {a,b}, [ab] and a trailing slash", () => {
  assert.ok(globToRegExp("src/{orders,refunds}.mjs").test("src/refunds.mjs"));
  assert.ok(!globToRegExp("src/{orders,refunds}.mjs").test("src/coupons.mjs"));
  assert.ok(globToRegExp("{app,lib}/billing/").test("lib/billing/x.rb"));
  assert.ok(globToRegExp("src/[ab].ts").test("src/b.ts"));
  assert.ok(!globToRegExp("src/[!ab].ts").test("src/a.ts"));
  assert.ok(globToRegExp("src/**/").test("src/x/y.ts"));
  assert.ok(globToRegExp("src/purchases/**").test("src/purchases"));
  assert.ok(globToRegExp("src/a+b.ts").test("src/a+b.ts"));
});

test("touchedAreas lists each touched area once, and the files in no area", () => {
  const out = touchedAreas(["src/purchases/cart.ts", "src/purchases/pay.ts", "src/billing/inv.ts", "README.md"], AREAS);
  assert.deepEqual(out, { touched: ["billing", "purchases"], outside: ["README.md"] });
});

test("grepFor: smoke alone, or smoke plus whole area tags", () => {
  assert.equal(grepFor([]), "@smoke");
  const re = new RegExp(grepFor(["pay", "billing"]));
  assert.ok(re.test("refund is refused @area-pay"));
  assert.ok(re.test("checkout @smoke"));
  assert.ok(!re.test("salary run @area-payroll"));
});

test("validatedAreas refuses a name a tag can't carry", () => {
  assert.deepEqual(validatedAreas({}), {});
  assert.throws(() => validatedAreas({ areas: { "Purchases Area": ["src/**"] } }), /lower-case/);
  assert.throws(() => validatedAreas({ areas: { purchases: "src/**" } }), /list of paths/);
});

function project(config, spec) {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-areas-"));
  mkdirSync(join(dir, ".qa"));
  mkdirSync(join(dir, "e2e"));
  writeFileSync(join(dir, ".qa", "config.json"), JSON.stringify({ testDir: "e2e", tracker: "none", ...config }));
  if (spec) writeFileSync(join(dir, "e2e", "x.spec.ts"), spec);
  return dir;
}

test("areas.mjs prints the grep for the changed files, and just @smoke without areas", () => {
  const run = (dir, ...a) => execFileSync("node", [join(SCRIPTS, "areas.mjs"), ...a], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  assert.equal(run(project({ areas: AREAS }), "--files", "src/billing/a.ts,docs/x.md"), "@smoke|@area-(?:billing)(?![\\w-])");
  assert.equal(run(project({}), "--files", "src/billing/a.ts"), "@smoke");
  const json = JSON.parse(run(project({ areas: AREAS }), "--files", "docs/x.md", "--json"));
  assert.deepEqual(json.outside, ["docs/x.md"]);
});

test("areas.mjs runs @smoke when git can't diff, and doesn't need git without areas", () => {
  const notRepo = project({ areas: AREAS });
  const res = spawnSync("node", [join(SCRIPTS, "areas.mjs"), "--base", "origin/main"], { cwd: notRepo, encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), "@smoke");
  assert.match(res.stderr, /warning: can't list the changed files against origin\/main/);
  const plain = spawnSync("node", [join(SCRIPTS, "areas.mjs"), "--base", "origin/main"], { cwd: project({}), encoding: "utf8" });
  assert.equal(plain.stdout.trim(), "@smoke");
  assert.equal(plain.stderr, "");
});

test("lint-specs: unknown or missing area tags warn; @a11y tests need no case id", () => {
  const spec = `import { test, expect, tr } from './fixtures';
test('pays', { annotation: tr('PU-01'), tag: '@area-purchases' }, async () => { expect(1).toBe(1); });
test('bills', { annotation: tr('BI-01'), tag: '@area-bills' }, async () => { expect(1).toBe(1); });
test('untagged', { annotation: tr('PU-02') }, async () => { expect(1).toBe(1); });
test('checkout page', { tag: ['@a11y', '@area-purchases'] }, async () => { expect(1).toBe(1); });
test('smoke without an area', { annotation: tr('PU-03'), tag: '@smoke' }, async () => { expect(1).toBe(1); });
`;
  const res = spawnSync("node", [join(SCRIPTS, "lint-specs.mjs"), "--json"], { cwd: project({ areas: AREAS }, spec), encoding: "utf8" });
  const out = JSON.parse(res.stdout);
  assert.equal(out.errors, 0, res.stdout);
  const msgs = out.findings.map((f) => f.message).join("\n");
  assert.match(msgs, /"bills" is tagged @area-bills, which isn't in "areas"/);
  assert.match(msgs, /"untagged" has no @area-<name> tag/);
  assert.match(msgs, /"smoke without an area" has no @area-<name> tag/);
  assert.doesNotMatch(msgs, /"pays"|checkout page/);
});
