#!/usr/bin/env node
// Install the QA Kit project templates into a client repo without clobbering anything.
//   node install-templates.mjs <pluginRoot> <targetDir> [--test-dir=e2e] [--with=antd] [--force=a,b] [--standalone]
//
// - Plain files are copied only when missing (listed under "skipped" otherwise, for a manual merge).
// - templates/e2e/** goes to <test-dir>/**, and every "e2e/" path reference is rewritten to match.
// - CLAUDE.qa.md (+ extras) is appended to CLAUDE.md between markers; re-running replaces the block.
// - .claude/settings.json is deep-merged into an existing one (arrays de-duplicated, existing keys kept).
// - gitignore.qa / prettierignore.qa append only the missing lines.
// - --with=antd (auto-detected from package.json) adds <test-dir>/support/antd.ts and its CLAUDE.md notes.
//   --with=mailpit (email inbox) and --with=a11y (axe checks) work the same way; packages an extra needs are listed
//   under detected.install (and go into qa/package.json in standalone mode).
// - --standalone (repos without Node): Playwright gets its own qa/ folder with a package.json, the config goes
//   to qa/playwright.config.ts, tests to qa/e2e, and .qa/ stays at the root. Commands run from the root as
//   "qa/node_modules/.bin/playwright test -c qa"; the config finds .env, sessions and reports from the root.
// Prints JSON: { created, merged, skipped, detected } so the caller knows what to finish by hand.

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join, relative, dirname, basename, resolve } from "node:path";
import { playwrightBin, configArgs } from "./lib/playwright-dir.mjs";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const [pluginRoot, dest = "."] = args.filter((a) => !a.startsWith("--"));
if (!pluginRoot) {
  console.error("usage: install-templates.mjs <pluginRoot> <targetDir> [--test-dir=e2e] [--with=antd] [--force=a,b] [--standalone]");
  process.exit(1);
}
const src = join(pluginRoot, "templates");
const extrasRoot = join(pluginRoot, "template-extras");
const standalone = args.includes("--standalone");
// Where Playwright's package.json and config live: the root, or qa/ in standalone mode.
const pwDir = standalone ? "qa" : ".";
const testDir = flag("test-dir", standalone ? "qa/e2e" : "e2e").replace(/^\.\//, "").replace(/\/+$/, "");
// The test folder as the Playwright config sees it (relative to the config's folder).
const configTestDir = relative(pwDir, testDir).split("\\").join("/");
const PW = playwrightBin(pwDir);
const PW_TEST = [`${PW} test`, ...configArgs(pwDir)].join(" ");
const force = new Set(flag("force", "").split(",").filter(Boolean));

// ---------------------------------------------------------------- detect

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};
const pkg = readJson(join(dest, "package.json")) || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const lock = (f) => existsSync(join(dest, f));
const detected = {
  packageManager: lock("pnpm-lock.yaml") ? "pnpm" : lock("yarn.lock") ? "yarn" : lock("bun.lockb") || lock("bun.lock") ? "bun" : "npm",
  node: existsSync(join(dest, ".nvmrc")) ? `.nvmrc (${readFileSync(join(dest, ".nvmrc"), "utf8").trim()})` : pkg.engines?.node ? `engines (${pkg.engines.node})` : "default 22",
  playwright: deps["@playwright/test"] || null,
  antd: deps.antd || null,
  unitRunner: deps.vitest ? "vitest" : deps.jest || pkg.jest ? "jest" : null,
  scripts: Object.keys(pkg.scripts || {}),
  testDir,
  standalone,
};
const extras = new Set(flag("with", detected.antd ? "antd" : "").split(",").filter(Boolean));
// npm packages an extra needs, installed next to @playwright/test.
const EXTRA_PACKAGES = { a11y: { "@axe-core/playwright": "^4.14.0" } };
const extraPackages = Object.assign({}, ...[...extras].map((e) => EXTRA_PACKAGES[e] || {}));
detected.install = Object.entries(extraPackages).filter(([p]) => !deps[p]).map(([p, v]) => `${p}@${v}`);

// ---------------------------------------------------------------- helpers

const created = [];
const merged = [];
const skipped = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Rewrite "e2e/" references when the repo uses another test folder (`to`: as seen from the file's folder).
const retarget = (text, to = testDir) =>
  to === "e2e"
    ? text
    : text
        .replace(/testDir: "\.\/e2e"/g, `testDir: "./${to}"`)
        .replace(/"testDir": "e2e"/g, `"testDir": "${to}"`)
        .replace(/(^|[\s`'"(])(\.\/)?e2e\//g, `$1$2${to}/`);
// Standalone: commands in docs, workflows and permissions run the qa/ folder's Playwright with its config.
const standaloneCommands = (text) =>
  standalone
    ? text
        .replace(/npx playwright test/g, PW_TEST)
        .replace(/npx playwright (show-report|install)/g, `${PW} $1`)
    : text;
const TEXT = /\.(md|ts|js|mjs|json|ya?ml|sh|example|qa)$/;

function writeFile(rel, content, mode) {
  const target = join(dest, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  if (mode) chmodSync(target, mode);
}

function appendMissingLines(srcFile, targetRel, header, { onlyIfExists = false, extra = [] } = {}) {
  const target = join(dest, targetRel);
  if (onlyIfExists && !existsSync(target)) return;
  const have = existsSync(target) ? readFileSync(target, "utf8").split(/\r?\n/) : [];
  const want = [...readFileSync(srcFile, "utf8").split(/\r?\n/), ...extra].filter((l) => l.trim() && !have.includes(l));
  if (!want.length) return;
  const base = have.join("\n").replace(/\n*$/, "");
  writeFile(targetRel, `${base}${base ? "\n\n" : ""}${header}\n${want.join("\n")}\n`);
  (have.length ? merged : created).push(`${targetRel} (+${want.length} lines)`);
}

const START = "<!-- qa-kit:conventions:start -->";
const END = "<!-- qa-kit:conventions:end -->";
function upsertClaudeMd(block) {
  const target = join(dest, "CLAUDE.md");
  const wrapped = `${START}\n${block.trim()}\n${END}`;
  if (!existsSync(target)) {
    writeFile("CLAUDE.md", `# ${pkg.name || "Project"}\n\n${wrapped}\n`);
    created.push("CLAUDE.md");
    return;
  }
  let text = readFileSync(target, "utf8");
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  text = re.test(text) ? text.replace(re, wrapped) : `${text.trimEnd()}\n\n---\n\n${wrapped}\n`;
  writeFileSync(target, text);
  merged.push("CLAUDE.md (QA conventions block)");
}

// Deep merge: objects merge recursively, arrays union (existing order first), existing scalars win.
function deepMerge(base, add) {
  if (Array.isArray(base) && Array.isArray(add)) return [...base, ...add.filter((x) => !base.some((b) => JSON.stringify(b) === JSON.stringify(x)))];
  if (base && add && typeof base === "object" && typeof add === "object" && !Array.isArray(base) && !Array.isArray(add)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(add)) out[k] = k in base ? deepMerge(base[k], v) : v;
    return out;
  }
  return base === undefined ? add : base;
}

// ---------------------------------------------------------------- install

const SPECIAL = new Set(["CLAUDE.qa.md", "gitignore.qa", "prettierignore.qa", ".claude/settings.json"]);

for (const file of walk(src)) {
  const rel = relative(src, file).split("\\").join("/");
  if (SPECIAL.has(rel)) continue;
  let outRel = rel;
  if (rel.startsWith("e2e/")) outRel = `${testDir}/${rel.slice(4)}`;
  else if (rel === "playwright.config.ts" && standalone) outRel = `${pwDir}/${rel}`;
  if (existsSync(join(dest, outRel)) && !force.has(outRel) && !force.has(rel)) {
    skipped.push(outRel);
    continue;
  }
  if (TEXT.test(rel)) {
    let text = readFileSync(file, "utf8");
    text = rel === "playwright.config.ts" ? retarget(text, configTestDir) : retarget(text);
    if (rel === ".qa/config.json" && standalone) text = text.replace(/"playwrightDir": "\."/, `"playwrightDir": "${pwDir}"`);
    // The CI action works out where Playwright is on its own, so it keeps both of its branches as written.
    if (!rel.startsWith(".github/actions/")) text = standaloneCommands(text);
    writeFile(outRel, text, rel.endsWith(".sh") ? 0o755 : undefined);
  }
  else {
    mkdirSync(dirname(join(dest, outRel)), { recursive: true });
    copyFileSync(file, join(dest, outRel));
  }
  created.push(outRel);
}

// CLAUDE.md block (+ extras' notes)
let block = readFileSync(join(src, "CLAUDE.qa.md"), "utf8");
for (const extra of extras) {
  const notes = join(extrasRoot, extra, `CLAUDE.${extra}.md`);
  if (existsSync(notes)) block = block.replace(/\n### What needs a person/, `\n${readFileSync(notes, "utf8").trim()}\n\n### What needs a person`);
}
upsertClaudeMd(standaloneCommands(retarget(block)));

// Standalone: Playwright's own package.json in qa/ (setup installs it there).
if (standalone) {
  const qaPkg = join(pwDir, "package.json");
  if (existsSync(join(dest, qaPkg))) {
    // Already there: add only the extras' packages it lacks (`npm install --prefix qa` then installs them).
    const current = readJson(join(dest, qaPkg));
    const missing = Object.entries(extraPackages).filter(([p]) => !current?.devDependencies?.[p] && !current?.dependencies?.[p]);
    if (!current || !missing.length) skipped.push(qaPkg);
    else {
      current.devDependencies = { ...current.devDependencies, ...Object.fromEntries(missing) };
      writeFile(qaPkg, JSON.stringify(current, null, 2) + "\n");
      merged.push(`${qaPkg} (+${missing.map(([p]) => p).join(", ")})`);
    }
  } else {
    // npm names can't start with a dot or underscore, so strip those (a scoped name loses its scope too).
    const base = (pkg.name || basename(resolve(dest))).replace(/^@[^/]+\//, "").replace(/[^\w.-]/g, "-").replace(/^[._-]+/, "").toLowerCase();
    const name = `${base || "app"}-qa`;
    writeFile(qaPkg, JSON.stringify({ name, private: true, scripts: { test: "playwright test" }, devDependencies: { "@playwright/test": "^1.64.1", "@types/node": "^22.0.0", ...extraPackages } }, null, 2) + "\n");
    created.push(qaPkg);
  }
}

// .claude/settings.json
const settingsSrc = JSON.parse(standaloneCommands(readFileSync(join(src, ".claude/settings.json"), "utf8")));
const settingsTarget = join(dest, ".claude/settings.json");
if (existsSync(settingsTarget)) {
  const current = readJson(settingsTarget);
  if (!current) skipped.push(".claude/settings.json (not valid JSON, merge by hand)");
  else {
    writeFileSync(settingsTarget, JSON.stringify(deepMerge(current, settingsSrc), null, 2) + "\n");
    merged.push(".claude/settings.json");
  }
} else {
  writeFile(".claude/settings.json", JSON.stringify(settingsSrc, null, 2) + "\n");
  created.push(".claude/settings.json");
}

const qaModules = standalone ? [`${pwDir}/node_modules/`] : [];
appendMissingLines(join(src, "gitignore.qa"), ".gitignore", "# QA Kit", { extra: qaModules });
appendMissingLines(join(src, "prettierignore.qa"), ".prettierignore", "# QA Kit", { onlyIfExists: true, extra: qaModules });

// Extras: files go under the test folder.
for (const extra of extras) {
  const dir = join(extrasRoot, extra);
  if (!existsSync(dir)) {
    skipped.push(`extra "${extra}" (unknown)`);
    continue;
  }
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split("\\").join("/");
    if (rel.startsWith("CLAUDE.")) continue;
    const outRel = `${testDir}/${rel}`;
    if (existsSync(join(dest, outRel)) && !force.has(outRel)) {
      skipped.push(outRel);
      continue;
    }
    writeFile(outRel, retarget(readFileSync(file, "utf8")));
    created.push(outRel);
  }
}

console.log(JSON.stringify({ created, merged, skipped, detected: { ...detected, extras: [...extras] } }, null, 2));
