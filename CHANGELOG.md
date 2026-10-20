# Changelog

## 0.2.0 (2026-10-20): lessons from the first pilot

Pilot: a mature Next.js + Postgres app (pnpm, antd 6, Jest, no staging environment).

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
