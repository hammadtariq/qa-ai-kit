# QA AI Kit

A Claude Code plugin that adds an AI-assisted QA process to any web-app repo. Claude writes test cases from a
ticket, turns them into Playwright tests, fixes broken tests and sorts CI failures. TestRail keeps the
official record, and a person approves the work at five checkpoints ("gates") before anything ships.

## Getting started

### 1. One-time setup (once for the whole agency)

Follow [docs/AGENCY-SETUP.md](docs/AGENCY-SETUP.md): turn on the TestRail API and add two custom fields,
create a CI Claude account, and add the GitHub secrets. Skip this if someone has already done it.

### 2. Install the plugin (once per person)

In Claude Code:

```
/plugin install qa-kit --marketplace hammadtariq/qa-ai-kit
```

On Claude Code older than 2.1.275: `/plugin marketplace add hammadtariq/qa-ai-kit`, then
`/plugin install qa-kit@qa-ai-kit`. Get updates later with `/plugin marketplace update qa-ai-kit`.

You need Node 18+ (22 recommended). Playwright 1.62+ is installed for you if the repo doesn't have it.

### 3. Add it to a project (once per repo)

Open the project's repo in Claude Code, with a clean git tree, and run:

```
/qa-kit:setup-project <testrail-project-id>
```

It works on a new `qa-kit/setup` branch and asks you two questions:

- **Where tests live**: `e2e/` by default.
- **How tests reach the app**: a **staging** URL with test accounts, or the **local app** (Playwright starts
  this checkout, and CI builds it against throwaway databases). Production is never used.

It then adds the Playwright config, test helpers, CI workflows and a `.qa/` folder (see
[What a project gets](#what-a-project-gets)). Before merging that branch:

1. Copy `qa.env.example` into your `.env` and fill it in (test login, TestRail user and API key).
2. Check `.qa/business-context.md`, especially the "must never go wrong" list. Every case is judged against it.
3. Add the per-repo GitHub variables and secrets listed in AGENCY-SETUP section 4, and create the `qa:*` labels.
4. Confirm `npx playwright test --project=setup` passes (the login works).

### 4. Test your first feature

```
/qa-kit:plan-feature PROJ-142
```

Pass a ticket id or a short description. For an existing feature with no ticket, it drafts a brief from the
code (`specs/briefs/<feature>.md`) for you to confirm first. Then follow the normal flow below.

## The normal flow

| Step | You run | Then a person… |
| --- | --- | --- |
| 1. Plan cases | `/qa-kit:plan-feature <ticket>` → `specs/cases/<feature>.csv` | **Gate 1**: reviews the CSV in any spreadsheet |
| 2. Send to TestRail | `/qa-kit:push-cases specs/cases/<feature>.csv` | QA lead bulk-approves the AI drafts in TestRail |
| 3. Write tests | `/qa-kit:generate-tests <section, plan or case ids>` | **Gate 2**: reviews the test PR |
| 4. CI runs them | automatic on each PR and nightly; results go to TestRail | – |
| 5. Failures | `/qa-kit:triage nightly \| pr <n>` (CI runs it for you) | **Gates 3–4**: handles escalations and bug drafts; reviews fix PRs |
| 6. Release | `/qa-kit:digest` (also posted to Slack) | **Gate 5**: signs off the release |

Other commands:

| Command | Use it when |
| --- | --- |
| `/qa-kit:review-cases <CSV or section>` | A feature has too many cases, you inherited a suite, or want a second opinion before Gate 1 |
| `/qa-kit:upkeep` | Weekly housekeeping |
| `/qa-kit:client-report [YYYY-MM]` | Monthly report for the client |

## How cases are designed

Claude thinks like the owner of the client's business, using `.qa/business-context.md` (the niche, how real
users behave, and what must never go wrong: money, stock, access, data). The playbook
[`test-design.md`](plugins/qa-kit/skills/plan-feature/test-design.md) asks for:

- acceptance criteria checked against what the code actually does;
- realistic **dirty paths**: bad input, double or out-of-order actions, lower roles via UI and API,
  cross-feature effects, dates and money, recovery;
- **no junk**: one case per business outcome, about 8–15 strong cases per feature, each with a
  "Why it matters" line.

The cases CSV (one row per case) is the source of truth. It's reviewed before anything reaches TestRail and
imports into other test tools too. Format: [`templates/specs/cases/README.md`](plugins/qa-kit/templates/specs/cases/README.md).

## What a project gets

- `playwright.config.ts` with JSON and JUnit reports, isolated retries and a saved login.
- `e2e/`: `fixtures.ts` (with the `tr('C123')` TestRail helper), `auth.setup.ts`, `seed.spec.ts`, plus
  Ant Design helpers if the app uses antd.
- QA rules appended to `CLAUDE.md`; the plugin and permissions merged into `.claude/settings.json`.
- `.qa/`: `config.json`, `business-context.md`, `app-setup.sh` (CI app prep: database, seed, build) and
  helper scripts (cases CSV, lint, failure extraction, flaky history, Slack digest, a browser watchdog).
- Two GitHub workflows:
  - **qa-pr.yml**: lints specs, runs changed and `@smoke` tests, uploads to TestRail; on failure Claude
    comments on the PR.
  - **qa-nightly.yml**: full regression at 01:00 PKT, TestRail upload, Claude triage (fix PRs, bug drafts,
    escalations, quarantine), then the Slack digest.

Guard hooks also stop Claude from committing keys or tokens, and from quietly changing a test's assertions.

## Linking tests to TestRail

```ts
import { test, expect, tr } from '../fixtures';

test('shows an error for an expired coupon', { annotation: tr('C1234'), tag: '@smoke' }, async ({ page }) => {
  // ...
});
```

Results land on the existing case C1234; no stray cases are created. Keep case ids out of test titles.

## Cost

Claude is only used to plan, write, fix and triage. Test runs, TestRail uploads, flaky tracking and the
daily digest are plain scripts, and CI triage is capped per run.

## Repo layout

```
.claude-plugin/marketplace.json   the marketplace
plugins/qa-kit/
  skills/                         the slash commands
  templates/                      what setup-project copies into a project
  mcp/testrail-server.mjs         TestRail access (can't approve cases or delete anything)
  hooks/, scripts/                guard hooks and setup helpers
docs/AGENCY-SETUP.md              one-time TestRail, GitHub and Claude account setup
```

See [CHANGELOG.md](CHANGELOG.md) for what changed between versions.
