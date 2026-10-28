// The template installer: the normal layout, another test folder, and standalone mode for repos without Node.
// Run: node --test 'plugins/qa-kit/tests/*.test.mjs'

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const PLUGIN = resolve(import.meta.dirname, "..");
const install = (dir, ...flags) =>
  JSON.parse(execFileSync("node", [join(PLUGIN, "scripts", "install-templates.mjs"), PLUGIN, dir, ...flags], { encoding: "utf8" }));
const read = (dir, f) => readFileSync(join(dir, f), "utf8");

test("default install: config at the root, tests in e2e/", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-install-"));
  writeFileSync(join(dir, "package.json"), '{"name":"shop"}');
  const out = install(dir);
  assert.equal(out.detected.standalone, false);
  assert.ok(existsSync(join(dir, "playwright.config.ts")));
  assert.ok(existsSync(join(dir, "e2e", "fixtures.ts")));
  assert.match(read(dir, ".qa/config.json"), /"playwrightDir": "\."/);
  assert.match(read(dir, "CLAUDE.md"), /`npx playwright test`/);
});

test("another test folder: the config import and testDir follow it", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-install-"));
  install(dir, "--test-dir=tests/e2e");
  const config = read(dir, "playwright.config.ts");
  assert.match(config, /from "\.\/tests\/e2e\/roles"/);
  assert.match(config, /testDir: "\.\/tests\/e2e"/);
  assert.match(read(dir, ".qa/config.json"), /"testDir": "tests\/e2e"/);
});

test("standalone: Playwright in qa/, .qa/ at the root, commands run qa/'s Playwright", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-kit-install-"));
  const out = install(dir, "--standalone", "--with=mailpit");
  assert.equal(out.detected.standalone, true);
  assert.equal(out.detected.testDir, "qa/e2e");
  for (const f of ["qa/package.json", "qa/playwright.config.ts", "qa/e2e/fixtures.ts", "qa/e2e/support/mailbox.ts", ".qa/config.json"])
    assert.ok(existsSync(join(dir, f)), f);
  assert.ok(!existsSync(join(dir, "playwright.config.ts")));
  // The config sits next to e2e/, so its paths stay relative to qa/.
  const config = read(dir, "qa/playwright.config.ts");
  assert.match(config, /from "\.\/e2e\/roles"/);
  assert.match(config, /testDir: "\.\/e2e"/);
  const qa = JSON.parse(read(dir, ".qa/config.json"));
  assert.equal(qa.testDir, "qa/e2e");
  assert.equal(qa.playwrightDir, "qa");
  assert.match(JSON.parse(read(dir, "qa/package.json")).devDependencies["@playwright/test"], /^\^1\./);
  assert.match(read(dir, "CLAUDE.md"), /`qa\/node_modules\/\.bin\/playwright test -c qa --grep @smoke`/);
  assert.match(read(dir, "CLAUDE.md"), /qa\/e2e\/support\/mailbox\.ts/);
  assert.ok(JSON.parse(read(dir, ".claude/settings.json")).permissions.allow.includes("Bash(qa/node_modules/.bin/playwright test -c qa:*)"));
  assert.match(read(dir, ".github/workflows/qa-pr.yml"), /Bash\(qa\/node_modules\/\.bin\/playwright test -c qa:\*\)/);
  assert.match(read(dir, ".gitignore"), /^qa\/node_modules\/$/m);
});
