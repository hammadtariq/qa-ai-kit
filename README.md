# QA AI Kit

A Claude Code plugin that tests your web app the way its owner would. Claude interviews you about your
business, writes short test cases in plain English, turns them into automated browser tests, and explains
failures. You approve the work at five checkpoints, in a spreadsheet and on GitHub. It works on any web app,
whatever it's built with, with or without TestRail.

**New here? Follow [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).** It takes about an hour, needs no
coding, and starts with installing Claude Code. The kit runs in Claude Code only (not Codex or Cursor).

## Quick start

In Claude Code, inside your app's folder:

```
/plugin install qa-kit --marketplace hammadtariq/qa-ai-kit
/qa-kit:setup-project
/qa-kit:discover
/qa-kit:plan-feature <ticket or short description>
/qa-kit:generate-tests specs/cases/<feature>.csv
```

| Command | What happens | What you do |
| --- | --- | --- |
| `setup-project` | Adds the test tools and GitHub automation on a `qa-kit/setup` branch; asks up to 3 questions | Add test logins to `.env`, merge the branch |
| `discover` | Interviews you (10-20 multiple-choice questions) about your business and what must never go wrong | Answer; read the two files it writes |
| `plan-feature` | Writes the feature's cases to `specs/cases/<feature>.csv` | **Gate 1**: fill the `decision` column in a spreadsheet |
| `generate-tests` | Writes and runs a test per kept case, opens a pull request | **Gate 2**: review and merge the pull request |
| (CI) | Runs tests on every pull request and nightly; Claude triages failures | **Gates 3-4**: decide on fixes and bug drafts |
| `digest` | Release summary, also posted to Slack | **Gate 5**: sign off |

Other commands: `/qa-kit:review-cases` (too many or inherited cases), `/qa-kit:upkeep` (weekly),
`/qa-kit:client-report` (monthly), `/qa-kit:triage` (CI runs it for you), `/qa-kit:push-cases` (TestRail only).

## What a case looks like

```gherkin
Given Ali paid Rs 5,000 for order A-17
When the store manager refunds Rs 6,000
Then the refund is refused with "Refund is more than the amount paid"
And order A-17 still shows Rs 5,000 paid and nothing refunded
```

Every case protects something you told Claude must never go wrong (money, stock, access, data), in your
business's own words. A script rejects technical words like "click" or "button". Each feature gets a short
list (about 6 to 20 cases, depending on how risky the area is), and an independent reviewer scores each case
before you see it. You make the final call.

## Safe by design

- Never runs against production: tests use staging or a copy of your app with throwaway data.
- Claude can't read your `.env` secrets or commit keys, and can't change what a test checks just to make it
  pass. When the app looks wrong, it drafts a bug report instead.
- The TestRail connection can't approve cases or delete anything.
- Claude is used only to plan, write, fix and triage. Test runs, reports and the daily summary are plain
  scripts.

## For teams and developers

- **Agency or multi-project setup** (TestRail fields, a CI Claude account, shared GitHub secrets):
  [docs/AGENCY-SETUP.md](docs/AGENCY-SETUP.md).
- **What setup adds to a project**: a Playwright config and `e2e/` folder (in `qa/` for apps without Node)
  with per-role logins and test data that cleans up after itself; a `.qa/` folder with the business context,
  glossary, settings (`.qa/config.json`) and helper scripts; QA rules in `CLAUDE.md`; and two GitHub
  workflows. The PR workflow runs the changed tests, the `@smoke` (P1) tests and the tests of the areas the
  PR touches. The nightly runs everything, then Claude triages and the digest is posted.
- **Optional extras** at setup: `--with=mailpit` (read the app's emails in tests), `--with=a11y`
  (accessibility checks on key pages). Extra browsers, phones and languages come from your answers in
  `discover`.
- **How cases are designed**: the playbook
  [test-design.md](plugins/qa-kit/skills/plan-feature/test-design.md) and
  [risk packs](plugins/qa-kit/skills/plan-feature/risk-packs/) for eight kinds of business. The CSV format:
  [templates/specs/cases/README.md](plugins/qa-kit/templates/specs/cases/README.md).
- **Linking tests to cases**: `test('...', { annotation: tr('C1234') }, ...)` with a TestRail id, or the CSV
  row's key (`tr('CO-04')`) without TestRail.

### Working on the kit

```
.claude-plugin/marketplace.json   the marketplace
plugins/qa-kit/
  skills/                         the slash commands
  templates/, template-extras/    what setup-project copies into a project
  mcp/testrail-server.mjs         TestRail access
  hooks/, scripts/                guard hooks and setup helpers
  tests/                          script tests (node --test, no dependencies)
  evals/                          skill evals on a sample app (claude plugin eval)
docs/                             getting started, agency setup, the improvement plan
```

Run `node --test 'plugins/qa-kit/tests/*.test.mjs'` before committing. Changes to `skills/` are checked by the
evals: see [plugins/qa-kit/evals/README.md](plugins/qa-kit/evals/README.md). What changed between versions:
[CHANGELOG.md](CHANGELOG.md).
