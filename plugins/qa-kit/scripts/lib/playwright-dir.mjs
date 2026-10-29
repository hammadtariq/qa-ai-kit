// Where a client repo's Playwright lives and how to run it from the repo root. `playwrightDir` in .qa/config.json is
// "." normally, "qa" in standalone mode (repos without Node). The CI action (qa-app-setup) builds the same command in shell.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function playwrightDirOf(projectDir = ".") {
  try {
    return JSON.parse(readFileSync(join(projectDir, ".qa/config.json"), "utf8")).playwrightDir || ".";
  } catch {
    return ".";
  }
}

// The Playwright binary as run from the root, and the extra arguments that point it at its config.
export const playwrightBin = (pwDir) => (pwDir === "." ? "npx playwright" : `${pwDir}/node_modules/.bin/playwright`);
export const configArgs = (pwDir) => (pwDir === "." ? [] : ["-c", pwDir]);
