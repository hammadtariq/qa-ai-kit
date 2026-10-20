# QA AI Kit

A Claude Code plugin marketplace that packages the agency QA pipeline: Claude plans, writes, heals and
triages Playwright tests; TestRail stays the system of record; people review at five gates.

```
story ──▶ /qa-kit:plan-feature ──▶ TestRail cases (AI draft) ──▶ Gate 1: QA lead approves
      ──▶ /qa-kit:generate-tests ──▶ spec PR ──▶ Gate 2: QA engineer reviews
      ──▶ CI: PR smoke + nightly regression ──▶ trcli ──▶ TestRail runs
      ──▶ failures ──▶ /qa-kit:triage (headless) ──▶ healer PR | Gate 3 escalation | Gate 4 bug draft
      ──▶ Slack digest (no LLM) ──▶ Gate 5: release sign-off
```

## What's inside

```
.claude-plugin/marketplace.json      marketplace "qa-ai-kit"
plugins/qa-kit/
  .claude-plugin/plugin.json         plugin "qa-kit"
  .mcp.json                          TestRail MCP server (bundled, zero dependencies)
  mcp/testrail-server.mjs            project-scoped; can't approve cases or delete anything
  hooks/hooks.json                   guard hooks on Write/Edit/MultiEdit
  scripts/guard-secrets.mjs          blocks keys and tokens in committed files
  scripts/guard-assertions.mjs       asks locally / denies in CI when a test's assertions change
  scripts/                           setup helpers (templates, .mcp.json merge, healer rules)
  skills/                            the slash commands below
  templates/                         what setup-project copies into a client repo
docs/AGENCY-SETUP.md                 one-time TestRail, GitHub and Claude account setup
```

## Skills

| Command | When | Human gate it feeds |
| --- | --- | --- |
| `/qa-kit:setup-project [testrail-project-id]` | Onboarding a client repo | – |
| `/qa-kit:plan-feature <ticket>` | Story is ready for QA | Gate 1: approve cases in TestRail |
| `/qa-kit:generate-tests <section, plan or case ids>` | After Gate 1 | Gate 2: review the spec PR |
| `/qa-kit:triage nightly \| pr <n>` | CI after failures, or locally | Gates 3 and 4 |
| `/qa-kit:digest` | Anytime: what's waiting for review | – |
| `/qa-kit:upkeep` | Weekly | – |
| `/qa-kit:client-report [YYYY-MM]` | Monthly, for the client | – |

## What a client repo gets

`playwright.config.ts` (JSON + JUnit reporters, isolated retries, storage-state login), `tests/fixtures.ts`
with the `tr('C123')` helper, `tests/auth.setup.ts`, `tests/seed.spec.ts`, `CLAUDE.md` conventions,
`.qa/config.json`, `.qa/scripts/` (lint, failure extraction, flaky history, Slack digest, id collection),
`.claude/settings.json`, and two workflows:

- **qa-pr.yml**: lint specs, run changed tests and `@smoke`, upload to TestRail, and on failure Claude
  triages and comments on the PR.
- **qa-nightly.yml**: full regression at 01:00 PKT, flaky history, TestRail upload, Claude triage (healer
  PR, bug drafts, escalations, quarantine), then the Slack digest.

## How tests link to TestRail

```ts
import { test, expect, tr } from '../fixtures';

test('shows an error for an expired coupon', { annotation: tr('C1234'), tag: '@smoke' }, async ({ page }) => {
  // ...
});
```

The JUnit reporter (`embedAnnotationsAsProperties: true`) writes `<property name="test_id" value="C1234"/>`,
and the workflows call `trcli parse_junit --case-matcher property -n`, so results land on existing cases and
no stray cases are created. Case ids don't go in titles: Playwright prefixes the JUnit name with describe
titles, which breaks trcli's name matching.

## Where Claude tokens are spent

Only in planning, generating, healing and triage. Test runs, TestRail uploads, flaky tracking and the
daily digest are plain scripts. Triage reads `.qa/scripts/failures.mjs` output and `error-context.md`
before ever opening a trace, and is capped with `--max-turns`.

## Getting started

1. Do the one-time steps in [docs/AGENCY-SETUP.md](docs/AGENCY-SETUP.md), then install the plugin in Claude Code:

   ```
   /plugin install qa-kit --marketplace your-org/qa-ai-kit
   ```

   (On Claude Code older than 2.1.275: `/plugin marketplace add your-org/qa-ai-kit`, then `/plugin install qa-kit@qa-ai-kit`.)
2. In a client repo: `/qa-kit:setup-project <testrail-project-id>`.
3. Plan the first feature: `/qa-kit:plan-feature PROJ-142`.

Requires Claude Code with plugin support, Node 18+ (22 recommended), Playwright 1.62+, Python for `trcli` in CI.
# qa-ai-kit
