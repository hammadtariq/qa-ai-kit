# One-time agency setup

Do these once for the agency. Each client project then takes about an hour with `/qa-kit:setup-project`.

## 1. Host the kit

1. Create a **private** GitHub repo, for example `your-org/qa-ai-kit`, and push this folder to it.
2. Each team member runs, once, in Claude Code:

   ```
   /plugin marketplace add your-org/qa-ai-kit
   /plugin install qa-kit@qa-ai-kit
   ```

   Client repos set up with the kit also list the marketplace in `.claude/settings.json`, so Claude Code
   offers the plugin when someone opens the repo.
3. To ship an update: change the plugin, bump `version` in `plugins/qa-kit/.claude-plugin/plugin.json`,
   push. Team members get it with `/plugin marketplace update qa-ai-kit`.

## 2. TestRail

1. **Administration > Site Settings > API**: tick *Enable API*.
2. Create a dedicated user, for example `qa-bot@your-agency.com`, with access only to client projects
   that use the kit. Generate its API key under *My Settings > API Keys*.
3. **Administration > Customizations > Add Field** (case fields):
   - **Review status**: Dropdown, system name `review_status`, options `1, AI draft` and `2, Approved`,
     default `1`. This drives Gate 1. In `.qa/config.json` it becomes
     `"reviewField": { "field": "custom_review_status", "draft": 1, "approved": 2 }`.
   - If your instance doesn't already have an automation field, add **Automated**: Checkbox, system name
     `automated`. In `.qa/config.json`: `"automatedField": { "field": "custom_automated", "value": true }`.
   Assign both fields to every project that uses the kit.
4. Set the projects' default template to *Test Case (Steps)* so cases keep separate steps and expected results.

The kit's TestRail server can't approve cases or delete anything, whatever the API user is allowed to do.

## 3. Claude accounts

- **People**: each QA member who runs Claude Code uses their own Claude plan and logs in with `claude`.
  Keep `ANTHROPIC_API_KEY` unset so usage stays on the plan.
- **CI**: create one Claude account just for automation so nightly triage never uses a person's 5-hour
  window. On a machine with a browser, log in as that account and run `claude setup-token`. Save the
  token as the `CLAUDE_CODE_OAUTH_TOKEN` secret (org-level secrets let every client repo share it).
  It's valid for a year: set a reminder at month 11.

## 4. GitHub

Org-level secrets, shared by client repos:

| Secret | Value |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | the CI account's token |
| `TESTRAIL_URL`, `TESTRAIL_USER`, `TESTRAIL_API_KEY` | the TestRail bot user |
| `QA_KIT_REPO_URL` | `https://x-access-token:<fine-grained PAT, read-only on qa-ai-kit>@github.com/your-org/qa-ai-kit.git` |
| `SLACK_WEBHOOK_URL` | optional, incoming webhook for the digest channel |

Per client repo: secrets `QA_USER_EMAIL`, `QA_USER_PASSWORD`; variables `BASE_URL`, `TESTRAIL_PROJECT_NAME`.

In each client repo, **Settings > Actions > General**: allow "Read and write permissions" and tick
"Allow GitHub Actions to create and approve pull requests", so nightly triage can open healer PRs.
PRs opened with the Actions token don't trigger other workflows; a reviewer re-runs checks from the PR
if needed.

Create these labels in each client repo (or org-wide):
`qa:gate-2`, `qa:heal`, `qa:gate-3`, `qa:gate-4`, `qa:quarantine`, `qa:env`, `bug`.

```bash
for l in qa:gate-2 qa:heal qa:gate-3 qa:gate-4 qa:quarantine qa:env; do gh label create "$l" --force; done
```

## 5. Before onboarding a client

Confirm the contract and NDA allow AI tooling on the client's app and staging data.
