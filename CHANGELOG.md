# Changelog

## 0.9.0 (2026-10-29): extras and checking the kit itself

Phase 4 of [docs/IMPROVEMENT-PLAN.md](docs/IMPROVEMENT-PLAN.md). Before, accessibility wasn't checked, every PR
ran the same `@smoke` set whatever it changed, and prompt changes to the skills shipped untested.

- **Accessibility (opt-in)**: `--with=a11y` adds `<testDir>/support/a11y.ts`, `expectAccessible(page)` on
  `@axe-core/playwright` (WCAG 2.1 A and AA rules). It fails only on serious and critical issues; minor and
  moderate ones go in an `a11y` annotation, and the full axe result is attached to the report. With
  `"a11y": true` in `.qa/config.json`, `generate-tests` adds one `@a11y` test per key-journey page to
  `<testDir>/a11y/key-pages.spec.ts`. Discover asks about accessibility (area 7) and turns it on. `@a11y`
  tests need no case id. The installer lists the package to install (`detected.install`), and in standalone
  mode puts it in `qa/package.json`.
- **Run only what a PR touches**: `.qa/config.json` → `areas`, e.g.
  `{ "purchases": ["src/purchases/**", "app/api/purchases/**"] }`. Discover fills it from the code, and
  plan-feature adds a missing area. `generate-tests` tags tests `@area-<name>`, and `lint-specs` warns on an
  unknown area tag or a test with none. `node .qa/scripts/areas.mjs --base origin/main` prints the `--grep` for
  `@smoke` plus the touched areas, and the PR workflow's smoke step uses it. Without `areas` it is `@smoke`,
  as before; the nightly still runs everything.
- **Evals for the skills** (`plugins/qa-kit/evals/`, run with `claude plugin eval`): a sample wholesale app
  with six known bugs, the owner's answers, and three briefs. `discover` and `plan-feature` run unattended,
  and graders check the business context, `cases.mjs check`, budget, risk coverage, known bugs, duplicates
  and readability. In this repo, `.github/workflows/kit-evals.yml` runs them on PRs that touch `skills/`,
  `templates/.qa/scripts/` or `evals/`, and `kit-tests.yml` runs the script tests on every plugin change.
- Review fixes: `areas.mjs` needs no git without `areas`, and runs `@smoke` with a warning when git can't diff
  against the base (it used to fail the smoke step); globs take `{a,b}`, `[ab]` and a trailing `/`; every test
  needs an area tag when `areas` is set (smoke and `@a11y` too); `@a11y` tests cover every key journey from
  the business context and carry their page's area; the installer adds an extra's packages to an existing
  `qa/package.json`; evals check the last `check` output, fail a run that reads the suite (`no-peeking`), and
  CI fails on any failed deterministic grader (`evals/hard-graders.mjs`).

Upgrading from 0.8.x:

1. `/plugin marketplace update qa-ai-kit`.
2. Copy `.qa/scripts/` from `templates/` (new: `areas.mjs`, `lib/areas.mjs`; changed: `lint-specs.mjs`).
3. In `qa-pr.yml`, replace the "Smoke tests" step with the template's "Smoke tests and the areas this PR
   touches".
4. Set `"kitVersion": "0.9.0"` in `.qa/config.json`. Optional: `areas`, and `"a11y": true` with
   `--with=a11y` and `npm i -D @axe-core/playwright@^4.14.0`.
5. Re-run `install-templates.mjs` to refresh the conventions block in `CLAUDE.md`.

## 0.8.0 (2026-10-28): works on any project

Phase 3 of [docs/IMPROVEMENT-PLAN.md](docs/IMPROVEMENT-PLAN.md). Before, tests shared seed data, the kit had
no pattern for email, payments or dates, setup stopped on a repo without `package.json`, TestRail was
assumed, and only desktop Chrome ran.

- **Test data that cleans up after itself**: a `data` fixture in `fixtures.ts`.
  `data.create('/api/suppliers', { name: data.name('Supplier') })` creates a record through the app's API,
  with a name unique to the run and worker, and deletes it when the test ends (last first; a failed delete is
  a "cleanup" annotation, not a failure). `remove: false` for records the app never deletes, inside a per-run
  organization. The playbook (new section 8) and `generate-tests` use it instead of ad-hoc setup.
- **Outside services, dates and time**: playbook section 8 and `generate-tests` rules: payments in the
  provider's test mode with its test cards, emails and SMS from a test inbox, anything else stubbed with
  `page.route` and a note on what the stub hides, dates with `page.clock`. New optional extra
  `--with=mailpit`: `<testDir>/support/mailbox.ts`, `mailbox(request).latest(to, { subject, since })` reads
  a Mailpit inbox and returns the text and links. Discover records how tests treat each service ("In tests"
  column).
- **Repos without Node (standalone mode)**: `install-templates.mjs --standalone` puts Playwright in `qa/`
  with its own `package.json`, the config in `qa/playwright.config.ts` and tests in `qa/e2e/`; `.qa/` stays
  at the root (`"playwrightDir": "qa"`). The config finds the repo root, so `.env`, sessions and reports stay
  there whether tests run from the root (`qa/node_modules/.bin/playwright test -c qa`) or from `qa/`.
  `patch-agents.mjs` points the agents' MCP server at `qa/`. `app.startCommand` can be any shell command
  (`bin/rails server -p 3100`). Checked on a small Python app: setup, tests from both folders, CI mode, the
  MCP server listing the tests.
- **Tracker as a setting**: `.qa/config.json` → `tracker`, `"testrail"` or `"none"` (default: TestRail when
  `testrail.projectId` is set). With `none`, `push-cases` stops with a pointer to `generate-tests`, tests
  carry the CSV key (`tr('PO-07')`), `lint-specs` accepts keys (and warns on a key when the tracker is
  TestRail), `collect-test-ids` lists keys, upkeep, digest and client-report work from the CSVs and the
  nightly reports. `node .qa/scripts/cases.mjs tracker` prints the setting for skills and scripts.
- **Browsers and devices from the contract**: `.qa/config.json` → `browsers`, e.g.
  `{ "devices": ["Desktop Safari", "iPhone 13"], "locales": ["ar-SA"] }`. Each adds a Playwright project that
  runs the `@smoke` tests (the P1 journeys); everything else stays on desktop Chrome. Discover (area 7) fills
  it; the CI action installs the browsers those devices need (`browsers: auto`).
- CI: the app-setup action installs Node dependencies where Playwright lives and exports `QA_TEST`, the
  test command the workflows now run. The TestRail upload runs only when the tracker is `testrail`, even if
  TestRail secrets are set at the organization level.
- Review fixes: the standalone `qa/package.json` gets a valid npm name when installing into `.`; the
  installer no longer rewrites the CI action's own commands; `data.create` fails at once when the response
  has no id to delete it by (instead of a `DELETE .../undefined` cleanup note); `generate-tests`,
  `review-cases` and setup's env check skip TestRail steps when the tracker is `none`; setup installs
  `qa/` after the installer writes it, and says to commit `qa/package-lock.json`.

Upgrading from 0.7.x:

1. `/plugin marketplace update qa-ai-kit`.
2. Copy from `templates/`: `.qa/scripts/` (all of it), `e2e/roles.ts` and `e2e/fixtures.ts` into your test
   folder (keep any fixtures you added), and `.github/actions/qa-app-setup/action.yml`. Re-run
   `install-templates.mjs` (as in setup step 4) to refresh the conventions block in `CLAUDE.md`; it skips
   files you already have.
3. In `playwright.config.ts`, take from the template: the `qaRoot` import and `root`, the `.env` and
   `reportDir` lines, `cwd: root` in `webServer`, and the `browsers` block with `...extraProjects`.
4. In both workflows, replace `npx playwright test` in `run:` lines with `$QA_TEST`, drop
   `browsers: chromium` from the nightly's app-setup step, and add the template's first line of the
   "Upload results to TestRail" step (it skips when the tracker isn't TestRail).
5. Nothing else changes for a TestRail project: without `tracker`, a set `testrail.projectId` still means
   TestRail. A project without TestRail: set `"tracker": "none"`.
6. Set `"kitVersion": "0.8.0"` in `.qa/config.json`.
7. Optional: `browsers` for extra devices; `--with=mailpit` for the email helper.

## 0.7.0 (2026-10-27): fewer, stronger cases

Phase 2 of [docs/IMPROVEMENT-PLAN.md](docs/IMPROVEMENT-PLAN.md). Before, the model that wrote the cases also
pruned them, every case was assumed to be a browser test, the budget was a flat 8-15, and there was one
login while permission cases need several.

- **Test level per case**: new CSV column `level`, `ui` (empty), `api` or `unit`. The playbook places each
  check at the cheapest level that can catch it: a validation table is `api` plus at most one `ui` case for
  the message; a pure calculation is `unit`. `api` cases are Playwright tests with `request` / `apiAs`, still
  reported to TestRail. `unit` rows are never pushed (a row already in TestRail that moves to `unit` is
  retired) and the plan lists them under "For developers". `check` warns when a `ui` case has more than 5
  data rows.
- **Independent scoring before Gate 1**: `plan-feature` step 5 (and `review-cases` on request) runs a
  subagent that reads only the CSV, the business context and the glossary, with the brief in
  `skills/plan-feature/scoring.md`. It scores every row: impact 1-3 × likelihood 1-3, unique, observable.
  **`cases.mjs apply-scores <csv> <scores.json>`** writes the new `score` column (`3x2`) and suggests
  `Merge into KEY` for duplicates, `Drop` for impact 1 (however common, unless the reviewer finds in the
  business context that the owner asked for it: `owner_asked: true`) and for impact × likelihood under 3,
  `Rewrite` for a Then nobody can see or a P1 without impact 3, each with the reason. It never fills
  `decision`. On a sample of 8 refund cases a fresh reviewer left 4: two merges, a rare bad-input table and a
  cosmetic dialog-title case dropped.
- **Case budget by risk tier** replaces the flat 8-15: `.qa/config.json` → `cases.budget` (defaults low 6,
  medium 12, high 20, counting `ui` + `api` rows). The tier comes from the area in the business context and
  is noted in the brief. `check --tier=<tier>` warns over budget and names the lowest-scoring rows; without
  `--tier` the medium budget applies. `check` warns on a P1 scored below impact 3.
- `check` fixes: a `ui` case with a long data table still gets the bad-row error next to the "use api"
  warning; a `data` cell holding only spaces no longer crashes it; a When without a Then no longer adds a
  warning about an `"undefined"` Then. `apply-scores` warns when a Drop, Merge or Rewrite comes without the
  reviewer's reason, and `plan` creates the plan's folder if it's missing.
- **One login per role**: `.qa/config.json` → `roles`, e.g. `{ "manager": { "env": "QA_MANAGER" } }`, read
  from `QA_MANAGER_EMAIL` / `QA_MANAGER_PASSWORD`. New `e2e/roles.ts`; `auth.setup.ts` logs in once per role
  and saves `playwright/.auth/<role>.json`; tests start as `defaultRole` (or the first role). New fixtures
  `asRole(role)` (a page in that role's session) and `apiAs(role)` (a request context with it), so a
  permission case checks the UI and a direct request in one test. With no `roles`, the single `QA_USER_*`
  login works as before (an empty `"roles": {}` counts as none). `defaultRole` must be one of the roles:
  a typo stops the run with `Unknown defaultRole "..."` instead of failing every test on a missing session
  file. Checked on a small two-role app: the permission case passes, fails when the app lets
  staff refund, and a project without `roles` still logs in once as `user`.
- `setup-project` asks which roles have test accounts and fills `roles`, `qa.env.example` and the workflows'
  env; the CI secrets table lists one pair per role. `generate-tests` writes `api` cases without a page,
  skips `unit` rows and uses `asRole` / `apiAs` for permission cases. `push-cases` shows `for_developers`.

Upgrading from 0.6.x:

1. `/plugin marketplace update qa-ai-kit`.
2. Copy `templates/.qa/scripts/cases.mjs` into `.qa/scripts/`, and `templates/e2e/roles.ts` into your test
   folder.
3. Single login, nothing else to do: existing CSVs (no `level` or `score`) read as `ui` and unscored, and
   `auth.setup.ts` / `fixtures.ts` keep working. The flat 8-15 warning becomes the medium budget (12);
   pass `--tier` for others.
4. Several roles: replace `auth.setup.ts` and `fixtures.ts` with the templates (keep your login locators and
   any fixtures you added), add `roles` (and optionally `defaultRole`) to `.qa/config.json`, take the
   `defaultRole` import and `storageState` line from `templates/playwright.config.ts`, and add one secret pair per role in `.env`,
   GitHub and each workflow job's `env:`.
5. Optionally add `cases.budget` to `.qa/config.json` to change the defaults.

## 0.6.0 (2026-10-27): ask the owner, write plain-language cases

Phase 1 of [docs/IMPROVEMENT-PLAN.md](docs/IMPROVEMENT-PLAN.md). Before, the business context was guessed
from repo docs (and on repos without docs, guesses became P1 cases), and cases read like test scripts that a
non-technical owner couldn't review quickly.

- **New skill `/qa-kit:discover`**: reads the repo, then interviews the product owner one multiple-choice
  question at a time, each answer drafted from the code and marked "(Recommended)". It follows up on every
  disaster until it is a rule a test can check, stops when every area is answered (10-20 questions on a first
  run), and on re-runs asks only about gaps: `(assumed)` facts, facts older than 6 months, placeholders.
  `/qa-kit:discover <area>` asks about one area. Without an owner in the session it writes drafts tagged
  `(assumed)` and lists the open questions.
- **`.qa/business-context.md`** gets a source tag on every fact (`(owner, date)`, `(code: path)` or
  `(assumed)`) and new sections: roles, key journeys, outside services, support promises, existing test
  coverage, releases, test environment and data, areas with a risk tier, open questions. Only owner facts
  justify a P1.
- **New `.qa/glossary.md`**: about 15 business terms, the words to avoid for each, and the names used in
  examples.
- **Cases are Gherkin in the business's words.** New CSV columns `scenario` (Given/When/Then lines) and
  `background` (shared Given lines, printed once per section in the plan). In TestRail the Given lines are
  the preconditions and each When/Then pair is one step and its expected result, keywords kept. The plan
  shows each case as a `gherkin` block, and `from-plan` reads those blocks back.
- **`cases.mjs check` enforces the writing rules** in `title` and `scenario` (`notes` and quoted text are
  never checked): errors for click, button, selector, endpoint, status code, database, xpath, css; for a
  scenario that doesn't start with Given or has a When with no Then; for more than 4 When/Then pairs; and
  for a `<placeholder>` missing from `data`. Warnings for page, field, screen, form, dropdown, URL, API;
  titles over 12 words; scenarios over 7 lines; a Then with nothing a person can see or with "correctly",
  "as expected", "works"; words the glossary avoids or doesn't have.
- **`cases.mjs migrate <csv>`** converts steps/expected rows to scenarios (Given from preconditions, When
  from each step, Then from its expected result, "; " splitting into And lines). It never changes `decision`
  or `testrail_id`, and marks each converted row `Rewrite: converted to Given/When/Then, check the wording`.
  `from-plan` writes scenarios too (`--legacy` for the old columns).
- **Playbook** (`test-design.md`): neutral examples from several kinds of business instead of one
  inventory app, a section on writing Gherkin cases, journeys as When/Then pairs, and good / bad case pairs.
  New **risk packs** (`skills/plan-feature/risk-packs/`) for ecommerce, SaaS billing, booking, marketplace,
  fintech ledgers, content / CMS, internal admin and healthcare; discover picks them, and they seed
  questions, never cases.
- **`plan-feature`** runs discover when the context is missing or a disaster is `(assumed)`, asks up to
  about six feature questions one at a time (each with the code's answer recommended) and records them in
  the brief's new `## Decisions` table, and has the planner write `gherkin` blocks. Without an owner it
  still posts the questions on the issue and stops.
- **`review-cases`** judges wording against the new rules (`Rewrite` covers technical wording and cases that
  are too long), imports TestRail sections as scenarios and offers `migrate` for old CSVs.
- **`generate-tests`** names each `test.step` after its scenario line (`When the manager approves order
  A-17`), so the HTML report reads like the case, and loops over `data` rows for placeholders.
- **`setup-project`** installs the glossary and ends by offering `/qa-kit:discover` (or telling the user to
  have the owner run it).
- **Tests for the kit's scripts**: `node --test 'plugins/qa-kit/tests/*.test.mjs'` (no dependencies) covers
  the old steps/expected path, scenario parsing, the TestRail mapping, the checks, migrate and the plan round
  trip.

Upgrading from 0.5.x:

1. `/plugin marketplace update qa-ai-kit`.
2. Copy `templates/.qa/scripts/cases.mjs`, `templates/.qa/glossary.md` and `templates/specs/cases/README.md`
   into the repo (`.qa/scripts/`, `.qa/`, `specs/cases/`), and add the "Each case is a short Gherkin
   scenario" line and `/qa-kit:discover` to the QA block in `CLAUDE.md` (from `templates/CLAUDE.qa.md`).
3. Run `/qa-kit:discover` with the product owner. Your existing `.qa/business-context.md` is kept: discover
   tags what it finds `(assumed)` until the owner confirms it, and keeps the "must never go wrong" numbers
   your CSVs already reference.
4. Existing cases CSVs keep working without changes. To convert one: `node .qa/scripts/cases.mjs migrate
   <csv>`, reword the converted rows, run `check`, then `/qa-kit:push-cases`. Ids stay the same, but the
   TestRail text changes to Given/When/Then, so every converted row is sent as an update once and goes back
   to AI draft for the QA lead to approve again. Rows that weren't converted aren't re-sent.

## 0.5.0 (2026-10-22): browser agents don't hang

From the pilot: `plan-feature`'s planner sometimes sat for minutes on one browser action until someone
stopped it by hand. Cause, in Playwright 1.64's test MCP server: the agent drives a page paused at the end of
the seed test, pausing sets the page's default timeout to 0, and the browser tools pass no timeout of their
own, so a click on an element that never becomes clickable (antd's hidden 0x0 option copies, an element
under an overlay) waits forever. Claude Code's `MCP_TOOL_TIMEOUT` is per server, so it would also cut off
the slow calls that are fine (`planner_setup_page`, `test_run`).

- **`.qa/scripts/mcp-guard.mjs`** wraps the `playwright-test` MCP server with per-tool time limits
  (`agents.toolTimeouts` in `.qa/config.json`; defaults: browser actions 45 s, navigation 90 s, page setup
  5 min, test runs unlimited). A call over its limit is answered with an error that tells the agent how to
  recover, the late reply is dropped, and the page stays usable. Every call is logged to
  `.qa-cache/mcp-guard.log`. Checked against the real server: a click on a hidden option ends at the limit
  and the next click and evaluate on the same page succeed; without the guard the same click was still
  waiting at 75 s.
- **`mcp-guard.mjs --watch --stale=120`**: a watchdog to run next to a background agent. It exits with a
  `STUCK:` line when a browser call has been open, or nothing has happened, for that long, which wakes the
  main session.
- **`scripts/patch-agents.mjs`** replaces `patch-healer.mjs` (kept as an alias): healer rules as before, a
  "When the browser gets stuck" block for the planner and generator (never retry the same ref, two attempts
  per step, then `## Not explored` and move on; stop on setup failure), and it puts the guard in front of
  `playwright-test` in `.mcp.json`. Re-run after every `init-agents`.
- **`plan-feature`**: warms the app first, runs the planner one risk group at a time, starts the watchdog for
  background runs, and asks the user about each blocked scenario (hint, explore by hand, skip, retry).
  `generate-tests` does the same for the generator.

Upgrading from 0.4.x: `/plugin marketplace update qa-ai-kit`, copy `templates/.qa/scripts/mcp-guard.mjs` into
the repo's `.qa/scripts/`, run `node <kit>/plugins/qa-kit/scripts/patch-agents.mjs`, optionally add the
`agents` block to `.qa/config.json`, and restart Claude Code so the MCP server starts behind the guard.

## 0.4.1 (2026-10-21): pushes match what TestRail holds

From aligning the pilot's CSV with TestRail after its first push:

- `cases.mjs payload` / `testrail` send preconditions as **setup + "Why it matters:"** only. `known_issue`,
  `notes`, `risks`, `source` and `key` stay in the repo (CSV, plan, `test.fixme()` reasons). Before, every
  push added those lines, so a CSV copied from TestRail looked changed on every row.
- Data tables in step 1 include the Markdown separator row, so TestRail renders them as tables (and matches
  tables written there by hand).
- The plan generator escapes `*` (and a `_` right before it) outside code spans: Prettier was rewriting
  `DEMO_EDITOR_*` into italics. `from-plan` removes the escapes again.
- `from-plan` keeps text as written (it no longer capitalises the first word).
- `specs/cases/README.md` lists which columns reach TestRail.

## 0.4.0 (2026-10-21): review cases in a CSV before they reach TestRail

From the pilot: cases went to TestRail first and were judged afterwards, so every merge or drop meant
editing approved cases (60 → 22 → 24 for one feature). Now the whole set is judged in a spreadsheet first.

- **Cases CSV, one row per case** (`specs/cases/<feature>.csv`): the source of truth for case design.
  Columns include `key` (a repo-owned id like `PO-07`), `testrail_id`, `risks` (ranks from the business
  context), `why_it_matters`, numbered `steps`/`expected`, a `data` table, `known_issue`, Claude's
  `suggestion` and the reviewer's `decision`. Format reference installed as `specs/cases/README.md`.
- **`.qa/scripts/cases.mjs`** (no dependencies): `check` (validation and business-risk coverage; `--push`
  also requires every row decided), `plan` (regenerates the plan's scenario block between markers),
  `payload` (TestRail-ready text for the push), `testrail` (TestRail CSV-import file, one row per step),
  `from-plan` (converts an existing Markdown plan), `set` (edits one row's cells). Files saved from Excel,
  Google Sheets or LibreOffice read back unchanged (BOM, CRLF and multi-line cells handled).
- **New skill `/qa-kit:push-cases`**: pushes Keep rows (creates new cases, updates changed ones, which go
  back to AI draft), moves Drop and Merge rows that are in TestRail to a Retired section, writes the ids back
  into the CSV, and shows the plan before changing anything. Still no approving and no deleting.
- **`plan-feature`** writes the CSV and stops for the sheet review instead of creating TestRail cases.
- **`review-cases`** reviews the CSV (or exports a TestRail section to one first) and writes its verdicts to
  `suggestion`; the reviewer's `decision` stays the reviewer's.
- **`generate-tests`** takes the CSV: Keep rows with a TestRail id, steps, data rows and known-issue reasons.
- The CSV imports into other test management tools directly; TestRail is one destination, not a dependency.

Upgrading from 0.3.0: `/plugin marketplace update qa-ai-kit`, then copy `templates/.qa/scripts/cases.mjs`,
`templates/.qa/scripts/lib/csv.mjs` and `templates/specs/cases/README.md` into the repo, and add the "Cases
live in specs/cases" line to the QA block in `CLAUDE.md`. (Re-running `install-templates.mjs` adds the new
files too, but it also replaces the QA block in `CLAUDE.md` with the template's, so copy by hand if you've
edited that block.) Convert an existing plan with `node .qa/scripts/cases.mjs from-plan`.

## 0.3.0 (2026-10-21): review and consolidate existing cases

From the pilot: the first regression plan for one feature came out at 60 cases, mostly sound but split
into fragments (one case per field, per role action, per revision type). The owner's review merged them
into 22 business cases.

- New skill `/qa-kit:review-cases <section or plan>`: reads a TestRail section with steps, judges every
  case against `.qa/business-context.md` and the playbook (keep / merge / rewrite / retire), picks the
  surviving id (automated first, then priority), keeps known-bug cases separate, lists uncovered risks and
  the specs affected, and writes `reports/case-review-<section>-<date>.md`. Read-only until the user
  confirms what to apply.
- TestRail server 0.3.0:
  - `testrail_get_cases` takes `details: true` to return preconditions and steps for a whole section in
    one call.
  - `testrail_update_case` takes `title`, `preconditions` and `steps` directly. Rewriting any of them sets
    the case back to **AI draft**, so an approved case Claude changes goes through Gate 1 again.
  - New `testrail_move_cases`: moves cases to another section (a "Retired" section) keeping ids, history
    and results. There are still no delete tools.
- `plan-feature` suggests `review-cases` when the existing section it builds on is bloated.

Upgrading from 0.2.0: `/plugin marketplace update qa-ai-kit`. Nothing changes in client repos; optionally
add `/qa-kit:review-cases` to the commands line of the QA block in `CLAUDE.md`.

## 0.2.0 (2026-10-20): lessons from the first pilot

Pilot: a mature Next.js + Postgres app (pnpm, antd 6, Jest, no staging environment).

### Business-first test design
- New playbook `skills/plan-feature/test-design.md`: a case exists only to protect something the business
  owner would lose. Acceptance criteria are the required business behaviour, **verified against the
  implementation** (gaps become cases or open questions, never expected results), with a catalogue of
  realistic dirty paths (bad input, state and permission abuse via UI and API, cross-feature integrity,
  repeats, dates and money, recovery) and "no junk" rules: one case per business outcome, journeys with
  checkpoints, data tables instead of one case per field, 8–15 cases per feature.
- New per-project `.qa/business-context.md`: the niche, users, what must never go wrong, invariants,
  real-world usage and past incidents. `setup-project` fills it; every plan and bug severity uses it.
- `plan-feature` loads the context, reads the implementation for gaps, prunes and merges before anything
  reaches TestRail, adds a "Why it matters" line to each case, and reports a risk → case table at Gate 1.
- `generate-tests` keeps the shape: one test per case, `test.step` per journey checkpoint, data-table
  loops, before/after business values, permission checks through UI and API, real double-submits.
- `triage` sets bug severity from business impact.

### Setup and templates
- Test folder defaults to `e2e/` (`--test-dir=<folder>` to change); every path in the templates follows it.
  `tests/` collided with Jest/Vitest default patterns.
- `qa.env.example` replaces `.env.example`, which a common `.env*` gitignore rule swallowed.
- `install-templates.mjs` now merges `.claude/settings.json` instead of skipping it, appends the QA
  conventions to an existing `CLAUDE.md` between markers (re-runs replace the block), and appends to an
  existing `.prettierignore`.
- Local-app mode for projects without staging: `app` in `.qa/config.json` drives Playwright's `webServer`,
  and `.qa/app-setup.sh` prepares the app in CI (database, seed, per-run login, build).
- Ant Design apps get `e2e/support/antd.ts` (`antSelect` and friends) and matching CLAUDE.md notes, added
  automatically when `antd` is a dependency. On antd 6, `getByRole("option")` hits a hidden 0x0
  accessibility list and clicks hang; unlinked Form.Item labels defeat `getByLabel`.
- CLAUDE.md tells the live-browser agents to type + Enter in dropdowns instead of clicking option refs
  (the planner looped on a hidden option in the pilot).

### CI
- New composite action `.github/actions/qa-app-setup`: npm, pnpm or Yarn from the lockfile, Node from
  `.nvmrc` or `engines`, test login export, `.qa/app-setup.sh`, browser install. Both workflows use it.
- Optional Postgres `services:` block in the workflows for local-app mode.
- TestRail upload skips when no test carries a `tr('C…')` id yet (trcli refuses an empty run and failed the step).
- The plugin marketplace defaults to the public kit URL; `QA_KIT_REPO_URL` is only needed for a private kit.

### TestRail
- `testrail_status` checks the configured field names against `get_case_fields` and suggests the right
  one. Newer instances expose custom fields as `custom_case_<name>`, not `custom_<name>`; with the wrong
  name, drafts weren't marked and the approval guard didn't apply.
- `testrail_update_case` refuses approval through any `*review_status` field, whatever it's called.

### Skills
- `setup-project`: chooses staging vs local-app mode, excludes the E2E folder from the unit runner, reads
  TestRail field names from the API, and checks `testrail_status` warnings.
- `plan-feature`: accepts a brief file; for existing features with no ticket it drafts a brief from the
  code (`brief-template.md`), with suspicious behaviour under "Open questions".
- `generate-tests`: uses `testDir` from `.qa/config.json` and the UI-library helpers.

### Upgrading a repo set up with 0.1.0
1. `/plugin marketplace update qa-ai-kit`.
2. In `.qa/config.json`, run `testrail_status` and fix any field-name warning.
3. Optional: copy `.github/actions/qa-app-setup` and the new workflows, and move your `.github/workflows`
   app steps into `.qa/app-setup.sh`. Repos that already work can keep their 0.1.0 workflows.

## 0.1.0 (2026-10-19)

First release: skills, TestRail MCP server, guard hooks, templates and workflows.
