#!/usr/bin/env node
// `npx playwright init-agents` replaces .mcp.json. Run this afterwards to merge back
// the servers the repo had before.
//   node merge-mcp.mjs <backup.json> <.mcp.json>
// Servers in the new file (playwright-test) win on a name clash.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [backupPath, targetPath = '.mcp.json'] = process.argv.slice(2);
if (!backupPath) {
  console.error('usage: merge-mcp.mjs <backup.json> [.mcp.json]');
  process.exit(1);
}
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
const backup = read(backupPath);
const current = read(targetPath);
const merged = { ...current, mcpServers: { ...(backup.mcpServers || {}), ...(current.mcpServers || {}) } };
writeFileSync(targetPath, JSON.stringify(merged, null, 2) + '\n');
console.log(`Merged MCP servers into ${targetPath}: ${Object.keys(merged.mcpServers).join(', ') || '(none)'}`);
