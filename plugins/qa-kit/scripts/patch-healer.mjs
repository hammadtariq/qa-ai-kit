#!/usr/bin/env node
// Append the agency's healing rules to the Playwright healer agent that
// `npx playwright init-agents --loop=claude` writes. Safe to run repeatedly:
// the block is replaced, not duplicated. Re-run after every init-agents.
//   node patch-healer.mjs [.claude/agents/playwright-test-healer.md]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = process.argv[2] || '.claude/agents/playwright-test-healer.md';
if (!existsSync(path)) {
  console.error(`Not found: ${path}. Run "npx playwright init-agents --loop=claude" first.`);
  process.exit(1);
}

const START = '<!-- qa-kit:healer-rules:start -->';
const END = '<!-- qa-kit:healer-rules:end -->';
const RULES = `${START}
## Agency healing rules (QA Kit)

These rules override anything above that conflicts with them.

- You may change **locators, waits and navigation steps** only.
- Never change an assertion's matcher or expected value (\`toHaveText('...')\`, \`toBe(...)\`,
  \`toMatchAriaSnapshot(...)\` and so on) and never delete an assertion. A hook blocks this in CI.
- If the app's behaviour itself looks wrong or changed, do not edit the test to match it.
  Mark it \`test.fixme()\` with a one-line reason and report it as "possible product bug" or "needs human decision".
- Never add \`waitForTimeout\`, \`page.pause()\` or \`test.only\`.
- Keep the \`test_id\` annotation and tags exactly as they are.
- After a fix, the test must pass 3 times in a row (\`--repeat-each=3\`) before you call it healed.
${END}`;

let text = readFileSync(path, 'utf8');
const re = new RegExp(`${START}[\\s\\S]*?${END}`);
text = re.test(text) ? text.replace(re, RULES) : `${text.trimEnd()}\n\n${RULES}\n`;
writeFileSync(path, text);
console.log(`Healer rules applied to ${path}`);
