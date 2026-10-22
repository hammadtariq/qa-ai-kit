#!/usr/bin/env node
// Apply the agency's rules to the agents and MCP config that
// `npx playwright init-agents --loop=claude` writes. Safe to run repeatedly: blocks between markers are
// replaced, not duplicated. Re-run after every init-agents (it overwrites these files).
//   node patch-agents.mjs [projectDir]
//
// - healer: healing rules (locators, waits and navigation only; never assertions)
// - planner, generator: what to do when the browser gets stuck (the QA Kit guard's timeout errors)
// - .mcp.json: runs the playwright-test server through .qa/scripts/mcp-guard.mjs (per-tool time limits)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] || ".";
const done = [];
const missing = [];

function upsert(path, name, body) {
  const file = join(dir, path);
  if (!existsSync(file)) return missing.push(path);
  const START = `<!-- qa-kit:${name}:start -->`;
  const END = `<!-- qa-kit:${name}:end -->`;
  const block = `${START}\n${body.trim()}\n${END}`;
  let text = readFileSync(file, "utf8");
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  text = re.test(text) ? text.replace(re, block) : `${text.trimEnd()}\n\n${block}\n`;
  writeFileSync(file, text);
  done.push(`${path} (${name})`);
}

const HEALER = `
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
`;

const STUCK = (what) => `
## When the browser gets stuck (QA Kit)

These rules override anything above that conflicts with them.

- Every browser action has a time limit (the QA Kit guard; \`agents.toolTimeouts\` in \`.qa/config.json\`).
  An error starting "QA Kit guard:" means that action would never have finished. **Never retry the same
  ref or selector.**
- Recover in this order: press Escape, take a fresh \`browser_snapshot\`, then try another way: type the
  option's text into the field and press Enter (ArrowDown + Enter for the next option), use a different
  element, or open the page's URL directly. Read the UI notes in \`CLAUDE.md\` first; they name the traps.
- **Two attempts per step.** If the step still doesn't work, stop that ${what}: note it under a
  \`## Not explored\` heading in your output (the ${what}, the step, what you tried, what the page showed)
  and move on to the next one. Don't wait, don't loop.
- If the setup tool (\`planner_setup_page\` / \`generator_setup_page\`) fails or times out, stop at once and
  report "app not reachable": nothing else will work until a person starts the app.
- If three ${what}s in a row end up under "Not explored", stop and report; the environment is probably broken.
- End with a short report: ${what}s done, ${what}s not explored and why. The main session asks the user
  what to do about each one.
`;

upsert(".claude/agents/playwright-test-healer.md", "healer-rules", HEALER);
upsert(".claude/agents/playwright-test-planner.md", "stuck-browser", STUCK("scenario"));
upsert(".claude/agents/playwright-test-generator.md", "stuck-browser", STUCK("test"));

// .mcp.json: put the guard in front of the playwright-test server.
const mcpPath = join(dir, ".mcp.json");
if (existsSync(mcpPath)) {
  const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
  const srv = mcp.mcpServers?.["playwright-test"];
  if (srv) {
    const args = srv.args || [];
    const guarded = srv.command === "node" && String(args[0] || "").endsWith("mcp-guard.mjs");
    if (!guarded) {
      mcp.mcpServers["playwright-test"] = {
        ...srv,
        command: "node",
        args: [".qa/scripts/mcp-guard.mjs", "--", srv.command, ...args],
      };
      writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n");
      done.push(".mcp.json (playwright-test runs through .qa/scripts/mcp-guard.mjs)");
    } else done.push(".mcp.json (already guarded)");
    if (!existsSync(join(dir, ".qa/scripts/mcp-guard.mjs")))
      missing.push(".qa/scripts/mcp-guard.mjs (copy it from the kit's templates)");
  } else missing.push(".mcp.json playwright-test server");
} else missing.push(".mcp.json");

console.log(JSON.stringify({ patched: done, missing }, null, 2));
