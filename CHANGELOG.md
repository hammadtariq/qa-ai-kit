# Changelog

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
