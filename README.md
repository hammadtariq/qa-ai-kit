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
  mcp/testrail-server.mjs            project-scoped; can't approve cases or delete anything (retires by moving)
  hooks/hooks.json                   guard hooks on Write/Edit/MultiEdit
  scripts/guard-secrets.mjs          blocks keys and tokens in committed files
  scripts/guard-assertions.mjs       asks locally / denies in CI when a test's assertions change
  scripts/install-templates.mjs      installs templates: merges settings, appends CLAUDE.md, picks test folder
  scripts/                           other setup helpers (.mcp.json merge, healer rules)
  skills/                            the slash commands below
  templates/                         what setup-project copies into a client repo
  template-extras/antd/              Ant Design select helpers, added when the app uses antd
docs/AGENCY-SETUP.md                 one-time TestRail, GitHub and Claude account setup
```

## Skills

| Command | When | Human gate it feeds |
| --- | --- | --- |
| `/qa-kit:setup-project [testrail-project-id]` | Onboarding a client repo | – |
| `/qa-kit:plan-feature <ticket or brief>` | Story ready for QA, or regression coverage for an existing feature | Gate 1: approve cases in TestRail |
| `/qa-kit:review-cases <section or plan>` | A section feels too big, an inherited suite, or before Gate 1 | Gate 1 again for rewritten cases |
| `/qa-kit:generate-tests <section, plan or case ids>` | After Gate 1 | Gate 2: review the spec PR |
| `/qa-kit:triage nightly \| pr <n>` | CI after failures, or locally | Gates 3 and 4 |
| `/qa-kit:digest` | Anytime: what's waiting for review | – |
| `/qa-kit:upkeep` | Weekly | – |
| `/qa-kit:client-report [YYYY-MM]` | Monthly, for the client | – |

## How cases are designed

Every skill thinks like the owner of the client's business. `.qa/business-context.md` records the niche,
what must never go wrong (money, stock, access, data) and how real users behave; the playbook
[`test-design.md`](plugins/qa-kit/skills/plan-feature/test-design.md) turns that into cases:

- acceptance criteria are the **required business behaviour, verified against the implementation**;
- the realistic **dirty paths** are covered (bad input, acting twice or out of order, lower roles via UI
  and API, cross-feature integrity, repeats, dates and money, recovery);
- **no junk**: one case per business outcome, journeys with checkpoints, data tables instead of a case per
  field, about 8–15 strong cases per feature, each with a "Why it matters" line.

## What a client repo gets

- `playwright.config.ts`: JSON + JUnit reporters, isolated retries, storage-state login, and a
  `webServer` that starts the app from `.qa/config.json` when `BASE_URL` is unset.
- `e2e/` (or the folder you choose): `fixtures.ts` with the `tr('C123')` helper, `auth.setup.ts`,
  `seed.spec.ts`, and `support/antd.ts` for Ant Design apps.
- A QA conventions block appended to `CLAUDE.md`; the plugin and permissions merged into `.claude/settings.json`.
- `.qa/business-context.md` (the owner's view of the product), `.qa/config.json`, `.qa/app-setup.sh` (CI app prep: database, seed, build), `.qa/scripts/` (lint,
  failure extraction, flaky history, Slack digest, id collection), `qa.env.example`.
- `.github/actions/qa-app-setup` (npm, pnpm or Yarn and the right Node version, detected) and two workflows:
  - **qa-pr.yml**: lint specs, run changed tests and `@smoke`, upload to TestRail, and on failure Claude
    triages and comments on the PR.
  - **qa-nightly.yml**: full regression at 01:00 PKT, flaky history, TestRail upload, Claude triage
    (healer PR, bug drafts, escalations, quarantine), then the Slack digest.

## Two ways to reach the app

| Mode | Use when | How |
| --- | --- | --- |
| Staging | The client has a staging URL with test accounts | `BASE_URL` variable; tests hit staging |
| Local app | No staging | Playwright starts this checkout (`app` in `.qa/config.json`); CI builds it against throwaway services from `.qa/app-setup.sh` |

Neither mode ever touches production.

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
   /plugin install qa-kit --marketplace hammadtariq/qa-ai-kit
   ```

   (On Claude Code older than 2.1.275: `/plugin marketplace add hammadtariq/qa-ai-kit`, then `/plugin install qa-kit@qa-ai-kit`.)
2. In a client repo: `/qa-kit:setup-project <testrail-project-id>`.
3. Plan the first feature: `/qa-kit:plan-feature PROJ-142`. For an existing feature with no ticket, let it
   draft a brief from the code (`specs/briefs/<feature>.md`), confirm it, then plan from the brief.

Requires Claude Code with plugin support, Node 18+ (22 recommended), Playwright 1.62+, Python for `trcli` in CI.

See [CHANGELOG.md](CHANGELOG.md) for what changed between versions.
