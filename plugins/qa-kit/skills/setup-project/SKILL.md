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

- Read `package.json`. Note the package manager (lockfile), the app's dev/start script, and any existing
  `@playwright/test` version, test folder and `playwright.config.*`.
- Check `git status`. If the tree is dirty, stop and ask the user to commit or stash first.
- Create a branch: `git checkout -b qa-kit/setup`.

## 2. Playwright

- If `@playwright/test` is missing or older than 1.62, install the latest:
  `npm i -D @playwright/test@latest` (use the repo's package manager), then `npx playwright install chromium`.
  1.62+ is needed for `retryStrategy: 'isolated'` and the bundled MCP server.

## 3. Templates

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install-templates.mjs" "${CLAUDE_PLUGIN_ROOT}/templates" .
```

It prints which files it created and which it skipped because they already exist.
For each skipped file, merge by hand:

- `playwright.config.ts`: keep the repo's projects and webServer, and add from the template the four
  reporters (list, html in `reports/html`, json in `reports/results.json`, junit with
  `embedAnnotationsAsProperties: true`), `retryStrategy: 'isolated'`, `trace: 'retain-on-failure'`,
  and the `setup` project with the storage-state dependency.
- `CLAUDE.md`: append the template's "QA conventions" section; don't replace the repo's own content.
- Workflows under `.github/workflows/`: if the repo already runs Playwright in CI, show the user the
  difference and ask which to keep.

## 4. Playwright test agents

```bash
cp .mcp.json .mcp.json.qa-backup 2>/dev/null || true
npx playwright init-agents --loop=claude
[ -f .mcp.json.qa-backup ] && node "${CLAUDE_PLUGIN_ROOT}/scripts/merge-mcp.mjs" .mcp.json.qa-backup .mcp.json
node "${CLAUDE_PLUGIN_ROOT}/scripts/patch-healer.mjs"
```

`init-agents` replaces `.mcp.json`; the merge puts back any servers the repo had. The TestRail server
comes from this plugin, so it does not need to be in `.mcp.json`.
If `init-agents` wrote its own `seed.spec.ts` next to the template's `tests/seed.spec.ts`, keep the
template one (it uses the shared fixtures) and delete the other.

## 5. Fill in the project specifics

- `.env`: you can't read it (project settings deny it, on purpose). Check what's set with
  `node -e "try{process.loadEnvFile('.env')}catch{};for(const k of ['BASE_URL','QA_USER_EMAIL','QA_USER_PASSWORD','TESTRAIL_URL','TESTRAIL_USER','TESTRAIL_API_KEY'])console.log(k, process.env[k]?'set':'MISSING')"`
  and ask the user to fill anything missing (copy from `.env.example`).
- `tests/auth.setup.ts`: open the app's login page on staging, find the real labels for email, password
  and submit, and update the locators. Prefer `getByRole` / `getByLabel`. Credentials stay as
  `process.env.QA_USER_EMAIL` / `QA_USER_PASSWORD`.
- `.claude/settings.json`: replace `YOUR_GITHUB_ORG` with the GitHub org that hosts the qa-ai-kit repo,
  so teammates who open this repo are offered the plugin automatically.
- `CLAUDE.md`: fill the placeholders (app name, staging URL variable, main user roles, areas of the app).
- `.qa/config.json`: set `testrail.projectId` (from `$ARGUMENTS` or ask) and `suiteId` if the project uses
  multiple suites. Then call `testrail_status` and `testrail_get_meta`:
  - If a dropdown field for review state exists (for example `custom_review_status`), set
    `testrail.reviewField` to `{ "field": "<system name>", "draft": <id of "AI draft">, "approved": <id of "Approved"> }`.
  - If an automation field exists (for example `custom_automation_type`), set
    `testrail.automatedField` to `{ "field": "<system name>", "value": <id meaning automated> }`.
  - If either is missing, leave it `null` and tell the user to add it (see the kit's docs/AGENCY-SETUP.md).

## 6. Check it works

- `npx playwright test --project=setup` passes with the credentials in `.env`.
- `npx playwright test tests/seed.spec.ts` passes.
- `node .qa/scripts/lint-specs.mjs` runs clean.

## 7. Hand-off

Commit on the branch (`chore: add QA Kit`), push, and open a PR. In the PR body list the
GitHub secrets and variables the workflows need:

| Name | Kind | Value |
| --- | --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | secret | from `claude setup-token` on the CI account |
| `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY` | secrets | dedicated TestRail API user |
| `QA_KIT_REPO_URL` | secret | `https://x-access-token:<token>@github.com/<org>/qa-ai-kit.git` |
| `QA_USER_EMAIL`, `QA_USER_PASSWORD` | secrets | seeded staging test account |
| `SLACK_WEBHOOK_URL` | secret, optional | channel for the daily digest |
| `BASE_URL` | variable | staging URL |
| `TESTRAIL_PROJECT_NAME` | variable | exact TestRail project name (trcli needs it) |

Remind the user to confirm the client's contract allows AI tooling on their app before the first run.
