#!/usr/bin/env node
// Fails when any deterministic grader (regex, tool_used, tool_order, file_exists) failed in any run, whatever
// the overall score: the score threshold tolerates noisy judges, not a CSV with check errors or a run that read
// the suite's own files.
//   node evals/hard-graders.mjs evals-result.json      (the file `claude plugin eval --json` wrote)

import { readFileSync } from 'node:fs';

const HARD = new Set(['regex', 'tool_used', 'tool_order', 'file_exists']);

export function hardFailures(result) {
  const out = [];
  for (const c of result.cases || []) {
    const types = Object.fromEntries((c.graders || []).map((g) => [g.name, g.type]));
    for (const [arm, runs] of Object.entries(c.arms || {})) {
      runs.forEach((run, i) => {
        for (const g of run.graders || []) {
          if (HARD.has(types[g.name]) && g.scored !== false && !g.passed) out.push(`${c.name} (${arm} run ${i + 1}): ${g.name}: ${g.explanation}`);
        }
      });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: hard-graders.mjs <eval result json>');
    process.exit(1);
  }
  const failures = hardFailures(JSON.parse(readFileSync(path, 'utf8')));
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(failures.length ? `${failures.length} deterministic grader(s) failed` : 'All deterministic graders passed');
  process.exit(failures.length ? 1 : 0);
}
