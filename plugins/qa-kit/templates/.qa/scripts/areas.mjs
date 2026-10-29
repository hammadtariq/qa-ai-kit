#!/usr/bin/env node
// The --grep for a PR run: @smoke plus the tests of every area whose paths the PR changed (`areas` in
// .qa/config.json). Without `areas`, just @smoke. The nightly still runs everything.
//   node .qa/scripts/areas.mjs --base origin/main     # prints the pattern, e.g. @smoke|@area-(?:purchases)(?![\w-])
//   node .qa/scripts/areas.mjs --files a.ts,b.rb --json

import { execFileSync } from 'node:child_process';
import { loadQaConfig } from './lib/specs.mjs';
import { areasOf, touchedAreas, grepFor } from './lib/areas.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

let areas;
try {
  areas = areasOf(loadQaConfig());
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const files = opt('files') !== undefined
  ? opt('files').split(',').filter(Boolean)
  : execFileSync('git', ['diff', '--name-only', `${opt('base') || 'origin/main'}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
const { touched, outside } = touchedAreas(files, areas);
const grep = grepFor(touched);

if (args.includes('--json')) console.log(JSON.stringify({ grep, touched, outside, areas: Object.keys(areas) }, null, 2));
else {
  if (Object.keys(areas).length) console.error(`Areas touched: ${touched.join(', ') || 'none'}; ${outside.length} changed file(s) in no area.`);
  console.log(grep);
}
