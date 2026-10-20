#!/usr/bin/env node
// Copy the QA Kit project templates into a client repo without overwriting anything.
//   node install-templates.mjs <templatesDir> <targetDir> [--force=<relpath>,<relpath>]
// Prints JSON: { created: [...], skipped: [...] } so the caller can merge skipped
// files (for example an existing playwright.config.ts) by hand.

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const args = process.argv.slice(2);
const [src, dest = '.'] = args.filter((a) => !a.startsWith('--'));
const force = new Set(
  (args.find((a) => a.startsWith('--force=')) || '--force=').slice(8).split(',').filter(Boolean)
);
if (!src) {
  console.error('usage: install-templates.mjs <templatesDir> <targetDir> [--force=a,b]');
  process.exit(1);
}

// Files stored with a safe name in the plugin and renamed on install.
const RENAME = { 'gitignore.qa': null }; // appended to .gitignore instead of copied

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const created = [];
const skipped = [];
for (const file of walk(src)) {
  const rel = relative(src, file);
  if (rel in RENAME) continue;
  const target = join(dest, rel);
  if (existsSync(target) && !force.has(rel)) { skipped.push(rel); continue; }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
  created.push(rel);
}

// .gitignore: append only the lines that are missing.
const ignoreSrc = join(src, 'gitignore.qa');
if (existsSync(ignoreSrc)) {
  const gi = join(dest, '.gitignore');
  const have = existsSync(gi) ? readFileSync(gi, 'utf8').split(/\r?\n/) : [];
  const want = readFileSync(ignoreSrc, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !have.includes(l));
  if (want.length) {
    if (!existsSync(gi)) writeFileSync(gi, '');
    appendFileSync(gi, (have.length && have.at(-1) !== '' ? '\n' : '') + '\n# QA Kit\n' + want.join('\n') + '\n');
    created.push(`.gitignore (+${want.length} lines)`);
  }
}

console.log(JSON.stringify({ created, skipped }, null, 2));
