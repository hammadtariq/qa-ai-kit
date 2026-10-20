#!/usr/bin/env node
// PreToolUse hook (Write|Edit|MultiEdit) on Playwright test files.
// If the change removes or alters an assertion matcher (expected values included):
//   - in CI (QA_LOCK_ASSERTIONS=1): deny, so the Healer cannot "fix" a real bug
//     by changing what the test expects. Claude must escalate to Gate 3 instead.
//   - locally: ask, so the person at the keyboard decides.
// Adding new assertions and changing locators are allowed silently.

import { readFileSync, existsSync } from 'node:fs';
import { removedMatchers, TEST_FILE } from './assertions.mjs';

function applyEdit(text, oldStr, newStr, all) {
  if (!oldStr) return text;
  return all ? text.split(oldStr).join(newStr) : text.replace(oldStr, () => newStr);
}

function respond(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
}

let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  const input = event.tool_input || {};
  const path = input.file_path || '';
  if (!TEST_FILE.test(path) || !existsSync(path)) process.exit(0); // new files are fine

  const before = readFileSync(path, 'utf8');
  let after = before;
  if (event.tool_name === 'Write') after = input.content || '';
  else if (event.tool_name === 'Edit') after = applyEdit(before, input.old_string, input.new_string || '', input.replace_all);
  else if (event.tool_name === 'MultiEdit') {
    for (const e of input.edits || []) after = applyEdit(after, e.old_string, e.new_string || '', e.replace_all);
  } else process.exit(0);

  const removed = removedMatchers(before, after);
  if (removed.length === 0) process.exit(0);

  const list = removed.slice(0, 5).map((r) => `  ${r.length > 120 ? r.slice(0, 117) + '...' : r}`).join('\n');
  const locked = process.env.QA_LOCK_ASSERTIONS === '1' || process.env.QA_LOCK_ASSERTIONS === 'true';
  if (locked) {
    respond('deny',
      `QA Kit (Gate 3): this change removes or alters assertions in ${path}:\n${list}\n` +
      'Do not change what a test expects in an automated run. Leave the test as it is, and escalate: ' +
      'open a GitHub issue labelled qa:gate-3 with the failure, the trace link and the assertion you think is outdated.');
  } else {
    respond('ask',
      `This edit changes assertions in ${path}:\n${list}\n` +
      'Approve only if the product behaviour intentionally changed.');
  }
  process.exit(0);
});
