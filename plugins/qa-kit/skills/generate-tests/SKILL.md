---
name: generate-tests
description: Write Playwright specs for TestRail cases the QA lead has approved, run them, and open a spec PR for review (Gate 2). Use after Gate 1 approval, or when the user asks to automate cases.
argument-hint: "<cases CSV (specs/cases/x.csv), TestRail section id, plan file in specs/, or case ids like C12 C13>"
disable-model-invocation: true
---

# Generate tests for approved cases

Input: `$ARGUMENTS`

`<testDir>` below is `testDir` from `.qa/config.json` (default `e2e`). Read the QA conventions in
`CLAUDE.md` first, including any UI-library helpers under `<testDir>/support/`.

## 1. Pick the cases

- Cases CSV (`specs/cases/<feature>.csv`, preferred): rows with `decision` = `Keep` and a `testrail_id`.
  The row has everything the test needs: `steps`/`expected` (one `test.step` each), `data` (loop over its
  rows), `known_issue` (the `test.fixme()` reason), `file` (where the test goes) and `priority`. Rows without
  a `testrail_id` haven't been pushed: run `/qa-kit:push-cases` first.
- Section id: `testrail_get_cases` with that `section_id`.
- Plan file: read the `**TestRail:** C…` ids from it.
- Case ids: `testrail_get_case` for each.

Keep only cases whose `review` is `approved` (when a review field is configured) and that are not already
automated. Find existing tests for these ids with
`grep -rn "tr(\"C\|tr('C" <testDir>/` so you don't write a second test for the same case. If nothing is left, say so and stop.

## 2. Generate

Create a branch `qa/tests-<feature-slug>`. Use the **playwright-test-generator** agent, one spec file per
feature, at `<testDir>/<area>/<feature-slug>.spec.ts`. Give it the plan file, the case details and these rules,
which match `CLAUDE.md`:

- Import `test` and `expect` from `../fixtures` (adjust the path), never from `@playwright/test` directly.
- Every test carries its case id: `test('shows an error for an expired coupon', { annotation: tr('C1234') }, async ({ page }) => { ... })`.
  This annotation is how results reach TestRail. Don't put the id in the title.
- P1 cases also get `tag: '@smoke'`.
- Locators: `getByRole`, `getByLabel`, `getByText`, then `getByTestId`. No CSS chains or XPath.
  Use the helpers in `<testDir>/support/` for component-library widgets (for example `antSelect` for
  Ant Design selects) instead of raw clicks on dropdown options.
- **One TestRail case = one test**, so each case gets one result. Keep the case's shape
  (playbook: `${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/test-design.md`):
  - journey case → one test with a `test.step()` per checkpoint (create, approve, stock, ledger, report),
    each ending in its own assertion, so a failure names the step;
  - data-table case → one test that loops over the table rows, each row in its own `test.step()` with
    `expect.soft` where later rows are still worth checking after one fails;
  - permission case → act as the lower role through the UI **and** call the API directly with that
    role's session (`request` with its storage state); both must be refused.
- Assert **business values**, not presence: read the starting value first (stock on hand, balance,
  count), act, then assert the exact new value computed from the inputs. Check the downstream screen or
  API the case names (dashboard, ledger, report), not only the form.
- Dirty paths are real actions: double-click Save (`dblclick`), submit twice, go back and resubmit, two
  pages on the same record, bad input typed as a user would. Assert there's no duplicate and no half-written record.
- Every test ends with an assertion on the business outcome (an order exists, a total is right, an error
  message is shown), not only that a page loaded. Use `toMatchAriaSnapshot` for regions where structure
  matters.
- No `waitForTimeout`, `page.pause()`, `test.only`, hard-coded credentials or production URLs.
- Create test data through the API (`request` fixture) where possible instead of clicking through setup,
  with unique names per run so repeats and parallel workers don't collide.

## 3. Verify

```bash
node .qa/scripts/lint-specs.mjs <testDir>/<area>/<feature-slug>.spec.ts
npx playwright test <testDir>/<area>/<feature-slug>.spec.ts --repeat-each=3
```

Fix lint findings. A test that fails because the app doesn't do what the case says is not a test problem:
mark it `test.fixme()` with the reason, list it in the PR as a possible bug, and draft a `qa:gate-4`
issue with the business impact ("supplier charged twice when approve is double-clicked"). Don't weaken
the assertion. Dirty-path cases are where these show up; that is the point of them.

## 4. Open the PR (Gate 2)

- Commit, push, and open a PR with `gh pr create --label qa:gate-2`.
- PR body: a table of case id, title, file and line, priority; anything marked fixme and why; the
  command to run the tests locally.
- Call `testrail_mark_automated` for the cases in the PR.

Tell the user the PR link and how many tests were added.
