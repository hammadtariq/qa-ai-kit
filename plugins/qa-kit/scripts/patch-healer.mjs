#!/usr/bin/env node
// Kept for older setup instructions: patch-agents.mjs now patches the healer, planner, generator and
// .mcp.json in one go.
//   node patch-healer.mjs [projectDir]

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.argv[2] = process.argv[2] && !process.argv[2].endsWith(".md") ? process.argv[2] : ".";
await import(join(dirname(fileURLToPath(import.meta.url)), "patch-agents.mjs"));
