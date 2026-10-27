---
name: setup-project
description: Set up the QA Kit in a client web-app repo - Playwright test agents, TestRail binding, CLAUDE.md conventions, guard rules and CI workflows. Use when onboarding a new client project to the agency QA pipeline, or re-running after a Playwright upgrade.
argument-hint: "[testrail-project-id]"
disable-model-invocation: true
---

# Set up the QA Kit in this repo

TestRail project id from the user, if given: `$ARGUMENTS`

Work through these steps in order. Report what you did at the end as a short checklist.
Never print secret values. Never overwrite a file the repo already has without saying so.

## 1. Look before changing anything

- Read `package.json`: package manager (lockfile), Node version (`.nvmrc` / `engines`), the app's
  `dev` / `build` / `start` scripts, UI library (antd, MUI...), and the unit test runner and its
  config (`jest.config.*` / `vitest.config.*` / `package.json#jest`).
- Note an existing `@playwright/test` version, test folder and `playwright.config.*`, and any CI that
  already runs Playwright.
- Check `git status`. If the tree is dirty, stop and ask the user to commit or stash first.
- Create a branch: `git checkout -b qa-kit/setup`.

## 2. Decide two things (ask if you can't tell)

**Test folder.** Default `e2e/`. Use another name only if the repo already keeps Playwright tests
somewhere. Avoid `tests/` when the unit runner uses default patterns: Jest and Vitest pick up any
`*.spec.ts` / `*.test.ts`, so Playwright files would run under the unit runner.

**How E2E reaches the app:**

| Mode | When | Set up |
| --- | --- | --- |
| **Staging** | The client has a staging URL with seeded test accounts | `BASE_URL` variable in CI and `.env`; `.qa/app-setup.sh` stays a no-op |
| **Local app** | No staging (common for agency projects) | Playwright starts this checkout: fill `app` in `.qa/config.json`; CI builds it against throwaway services filled in `.qa/app-setup.sh` |

Never point either mode at production. If the only database the app knows is production, stop and
agree a local or staging database with the user first.

## 3. Playwright

- If `@playwright/test` is missing or older than 1.62, install the latest with the repo's package
  manager (`npm i -D` / `pnpm add -D` / `yarn add -D @playwright/test@latest`), then
  `npx playwright install chromium`. 1.62+ is needed for `retryStrategy: 'isolated'`.

## 4. Templates

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install-templates.mjs" "${CLAUDE_PLUGIN_ROOT}" . --test-dir=<folder from step 2>
```

It prints JSON with `created`, `merged`, `skipped` and `detected` (package manager, Node, antd, unit runner):

- `CLAUDE.md`: the QA conventions are appended between `qa-kit:conventions` markers (re-running replaces them).
- `.claude/settings.json`: merged into the existing file (the plugin, Playwright permissions, `.env` read deny).
- antd detected: `<folder>/support/antd.ts` and its notes are added automatically (`--with=antd` forces it).
- For each `skipped` file, merge by hand. For an existing `playwright.config.ts`, keep the repo's
  projects and add from the template: the four reporters (list, html in `reports/html`, json in
  `reports/results.json`, junit with `embedAnnotationsAsProperties: true`), `retryStrategy: 'isolated'`,
  `trace: 'retain-on-failure'`, the `webServer` block driven by `.qa/config.json`, and the `setup`
  project with the storage-state dependency.
- Unit runner with default patterns: exclude the test folder (Jest `testPathIgnorePatterns: ["/<folder>/"]`,
  Vitest `exclude: [...configDefaults.exclude, "<folder>/**"]`), then run the unit tests to confirm.

## 5. Playwright test agents

```bash
cp .mcp.json .mcp.json.qa-backup 2>/dev/null || true
npx playwright init-agents --loop=claude
[ -f .mcp.json.qa-backup ] && node "${CLAUDE_PLUGIN_ROOT}/scripts/merge-mcp.mjs" .mcp.json.qa-backup .mcp.json
node "${CLAUDE_PLUGIN_ROOT}/scripts/patch-agents.mjs"
```

`init-agents` replaces `.mcp.json` and the agent files; the merge puts back any servers the repo had, and
`patch-agents.mjs` adds the agency rules to the healer, planner and generator and runs `playwright-test`
through `.qa/scripts/mcp-guard.mjs` (per-tool time limits, so a stuck browser action errors instead of
hanging). Re-run both after every `init-agents`. The TestRail server
comes from this plugin, so it does not need to be in `.mcp.json`. If `init-agents` wrote its own
`seed.spec.ts` next to the template's `<folder>/seed.spec.ts`, keep the template one and delete the other.

## 6. Fill in the project specifics

- `.env`: you can't read it (project settings deny it, on purpose). Check what's set with
  `node -e "try{process.loadEnvFile('.env')}catch{};const c=JSON.parse(require('fs').readFileSync('.qa/config.json','utf8'));const roles=Object.keys(c.roles||{}).length?c.roles:{user:{env:'QA_USER'}};const r=Object.entries(roles).flatMap(([n,v])=>{const e=v?.env||'QA_'+n.toUpperCase().replace(/\\W+/g,'_');return[e+'_EMAIL',e+'_PASSWORD']});for(const k of ['BASE_URL',...r,'TESTRAIL_URL','TESTRAIL_USER','TESTRAIL_API_KEY'])console.log(k, process.env[k]?'set':'MISSING')"`
  and ask the user to fill anything missing from `qa.env.example`. In local-app mode also confirm the
  app's own database variables point at a local database, not production.
- **Local-app mode:**
  - `.qa/config.json` → `app`: `startCommand` (CI, after a build, e.g. `pnpm start -p 3100`),
    `devCommand` (local, e.g. `pnpm dev -p 3100`), `port`, `readyPath` (a page that loads without login, e.g. `/login`).
  - `.qa/app-setup.sh`: the CI steps the app needs: create the database, migrate, seed test data,
    write a per-run test login to `$GITHUB_ENV` (masked), build. Read the repo's own scripts and docs for
    migrations and seeds; never seed against a shared database.
  - Both workflows: uncomment the `services:` block if the app needs a database, in every job that runs tests.
- **Roles.** Permission cases need one login per role. From the app's role list (and discover's answer on
  seeded accounts, if it ran), ask which roles have a test account. With more than one, set
  `.qa/config.json` → `roles`, e.g. `{ "manager": { "env": "QA_MANAGER" }, "staff": { "env": "QA_STAFF" } }`
  (only roles with an account), and `defaultRole` if the first isn't the one most tests start as. Each role
  reads `<env>_EMAIL` / `<env>_PASSWORD`; add the pairs to `qa.env.example` and the user's `.env`, and
  uncomment and copy the `QA_ADMIN_*` lines in each job's `env:` in both workflows, one pair per role. With
  `roles` left `null`, there's one login, `QA_USER_EMAIL` / `QA_USER_PASSWORD`, as before.
- `<folder>/auth.setup.ts`: open the login page, find the real field labels and submit button, and update
  the locators (`getByRole` / `getByLabel`). It logs in once per role (`<folder>/roles.ts`) and saves
  `playwright/.auth/<role>.json`; credentials always come from the environment.
- `CLAUDE.md` QA block: replace `ROLE_LIST`, `AREA_LIST` and `TEST_DATA_NOTES` with real values.
- `.qa/business-context.md` and `.qa/glossary.md`: installed as templates. They are filled by
  `/qa-kit:discover`, an interview with the product owner, at the end of setup (step 9). Don't fill them
  from guesses here; every plan and bug severity is judged against them.
- `.qa/config.json` → `testrail`: set `projectId` (from `$ARGUMENTS` or ask) and `suiteId` for
  multi-suite projects. Then call `testrail_status` and `testrail_get_meta`:
  - Field names come from `testrail_get_meta` (`system_name`), **not** from the TestRail admin screen.
    Newer instances prefix custom fields with `case_`, e.g. `custom_case_review_status`.
  - Review dropdown found: `testrail.reviewField` = `{ "field": "<system_name>", "draft": <id of "AI draft">, "approved": <id of "Approved"> }`.
  - Automation field found: `testrail.automatedField` = `{ "field": "<system_name>", "value": <true or the id meaning automated> }`.
  - If the project's default template is "Test Case (Text)", set `templateId` to the "Test Case (Steps)" id.
  - Run `testrail_status` again: `warnings` must be empty. If either field is missing, tell the user to
    add it (see the kit's docs/AGENCY-SETUP.md).

## 7. Check it works

- `npx playwright test --project=setup` passes (one "authenticate as <role>" per role), then
  `npx playwright test <folder>/seed.spec.ts`.
- In local-app mode, also run once with `CI=1` so Playwright starts the built app the way CI will.
- `node .qa/scripts/lint-specs.mjs` runs clean, and the unit tests still pass.
- `npx prettier --check` on the new files if the repo uses Prettier (its pre-commit hooks will format otherwise).

## 8. Hand-off

Commit on the branch (`chore: add QA Kit`), push, and open a PR. In the PR body list the
GitHub secrets and variables the workflows need:

| Name | Kind | Value |
| --- | --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | secret | from `claude setup-token` on the CI account |
| `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY` | secrets | dedicated TestRail API user |
| `TESTRAIL_PROJECT_NAME` | variable | exact TestRail project name (trcli needs it) |
| `BASE_URL` | variable | staging URL (staging mode only) |
| `QA_USER_EMAIL`, `QA_USER_PASSWORD` | secrets | staging test account (not needed if `.qa/app-setup.sh` creates one per run, or when `roles` is set) |
| `<env>_EMAIL`, `<env>_PASSWORD` per role | secrets | one pair per role in `.qa/config.json` `roles`, e.g. `QA_MANAGER_EMAIL` (only when `roles` is set) |
| `QA_KIT_REPO_URL` | secret, optional | only if the kit repo is private: `https://x-access-token:<token>@github.com/<org>/qa-ai-kit.git` |
| `SLACK_WEBHOOK_URL` | secret, optional | channel for the daily digest |

Also: Settings → Actions → General → "Read and write permissions" and "Allow GitHub Actions to create
and approve pull requests" (for healer PRs), and create the labels
(`for l in qa:gate-2 qa:heal qa:gate-3 qa:gate-4 qa:quarantine qa:env; do gh label create "$l" --force; done`).

Remind the user to confirm the client's contract allows AI tooling on their app before the first run.
The first test results reach TestRail only once a test carries a `tr('C…')` annotation; until then the
upload step skips.

## 9. Business context

Ask the user (AskUserQuestion) whether they can answer for the business now:

- **Yes, I'm the owner (or speak for them):** run `/qa-kit:discover`. It reads the repo, then asks 10-20
  multiple-choice questions and writes `.qa/business-context.md` and `.qa/glossary.md`. Commit them on the
  setup branch.
- **No, someone else is:** tell them to have the product owner run `/qa-kit:discover` in this repo before
  the first `/qa-kit:plan-feature`. It can be re-run any time, and asks only about gaps.
