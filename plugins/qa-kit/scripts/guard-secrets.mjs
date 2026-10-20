#!/usr/bin/env node
// PreToolUse hook (Write|Edit|MultiEdit): deny writes that put a credential into a
// file that could be committed. Local .env files are exempt (they are gitignored).

import { basename } from 'node:path';

const PATTERNS = [
  ['Anthropic API key or OAuth token', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['AWS access key id', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['Slack webhook URL', /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/],
  ['Stripe secret key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  // A literal value assigned to a credential-looking name. Values that read from
  // the environment (process.env, ${...}) never match because they are not quoted literals.
  ['hard-coded credential', /\b(?:password|passwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'`](?![\s"'`]*$)(?!\$\{)[^"'`\s]{8,}["'`]/i],
];

function exemptFile(path) {
  const name = basename(path || '');
  if (/^\.env(\..+)?$/.test(name)) return !/\.(example|sample|template)$/.test(name);
  return false;
}

function newText(toolName, input) {
  if (toolName === 'Write') return input.content || '';
  if (toolName === 'Edit') return input.new_string || '';
  if (toolName === 'MultiEdit') return (input.edits || []).map((e) => e.new_string || '').join('\n');
  return '';
}

function decide(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
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
  if (exemptFile(input.file_path)) process.exit(0);
  const text = newText(event.tool_name, input);
  for (const [label, re] of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const shown = m[0].length > 12 ? `${m[0].slice(0, 8)}...` : m[0];
      decide(
        `QA Kit blocked this write to ${input.file_path || 'a file'}: it appears to contain a secret (${label}: "${shown}"). ` +
        'Read secrets from environment variables (process.env.NAME) and keep values in .env locally or in CI secrets.'
      );
      process.exit(0);
    }
  }
  process.exit(0);
});
