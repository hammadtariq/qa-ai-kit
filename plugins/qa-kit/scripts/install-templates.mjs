#!/usr/bin/env node
// Install the QA Kit project templates into a client repo without clobbering anything.
//   node install-templates.mjs <pluginRoot> <targetDir> [--test-dir=e2e] [--with=antd] [--force=a,b]
//
// - Plain files are copied only when missing (listed under "skipped" otherwise, for a manual merge).
// - templates/e2e/** goes to <test-dir>/**, and every "e2e/" path reference is rewritten to match.
// - CLAUDE.qa.md (+ extras) is appended to CLAUDE.md between markers; re-running replaces the block.
// - .claude/settings.json is deep-merged into an existing one (arrays de-duplicated, existing keys kept).
// - gitignore.qa / prettierignore.qa append only the missing lines.
// - --with=antd (auto-detected from package.json) adds <test-dir>/support/antd.ts and its CLAUDE.md notes.
// Prints JSON: { created, merged, skipped, detected } so the caller knows what to finish by hand.

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const [pluginRoot, dest = "."] = args.filter((a) => !a.startsWith("--"));
if (!pluginRoot) {
  console.error("usage: install-templates.mjs <pluginRoot> <targetDir> [--test-dir=e2e] [--with=antd] [--force=a,b]");
  process.exit(1);
}
const src = join(pluginRoot, "templates");
const extrasRoot = join(pluginRoot, "template-extras");
const testDir = flag("test-dir", "e2e").replace(/^\.\//, "").replace(/\/+$/, "");
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
};
const extras = new Set(flag("with", detected.antd ? "antd" : "").split(",").filter(Boolean));

// ---------------------------------------------------------------- helpers

const created = [];
const merged = [];
const skipped = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Rewrite "e2e/" references when the repo uses another test folder.
const retarget = (text) =>
  testDir === "e2e"
    ? text
    : text
        .replace(/testDir: "\.\/e2e"/g, `testDir: "./${testDir}"`)
        .replace(/"testDir": "e2e"/g, `"testDir": "${testDir}"`)
        .replace(/(^|[\s`'"(])e2e\//g, `$1${testDir}/`);
const TEXT = /\.(md|ts|js|mjs|json|ya?ml|sh|example|qa)$/;

function writeFile(rel, content, mode) {
  const target = join(dest, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  if (mode) chmodSync(target, mode);
}

function appendMissingLines(srcFile, targetRel, header, { onlyIfExists = false } = {}) {
  const target = join(dest, targetRel);
  if (onlyIfExists && !existsSync(target)) return;
  const have = existsSync(target) ? readFileSync(target, "utf8").split(/\r?\n/) : [];
  const want = readFileSync(srcFile, "utf8").split(/\r?\n/).filter((l) => l.trim() && !have.includes(l));
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
  const outRel = rel.startsWith("e2e/") ? `${testDir}/${rel.slice(4)}` : rel;
  if (existsSync(join(dest, outRel)) && !force.has(outRel) && !force.has(rel)) {
    skipped.push(outRel);
    continue;
  }
  if (TEXT.test(rel)) writeFile(outRel, retarget(readFileSync(file, "utf8")), rel.endsWith(".sh") ? 0o755 : undefined);
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
upsertClaudeMd(retarget(block));

// .claude/settings.json
const settingsSrc = readJson(join(src, ".claude/settings.json"));
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

appendMissingLines(join(src, "gitignore.qa"), ".gitignore", "# QA Kit");
appendMissingLines(join(src, "prettierignore.qa"), ".prettierignore", "# QA Kit", { onlyIfExists: true });

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
