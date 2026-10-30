---
name: generate-tests
description: Write Playwright specs for approved cases (from the cases CSV, or TestRail), run them, and open a spec PR for review (Gate 2). Use after Gate 1 approval, or when the user asks to automate cases.
argument-hint: "<cases CSV (specs/cases/x.csv), TestRail section id, plan file in specs/, or case ids like C12 C13>"
disable-model-invocation: true
---

# Generate tests for approved cases

Input: `$ARGUMENTS`

`<testDir>` below is `testDir` from `.qa/config.json` (default `e2e`). Read the QA conventions in
`CLAUDE.md` first, including any helpers under `<testDir>/support/` (UI-library widgets, the `mailbox`).
`<test command>` is the one in `CLAUDE.md` → Commands: `npx playwright test`, or
`qa/node_modules/.bin/playwright test -c qa` in standalone mode. Run
`node .qa/scripts/cases.mjs tracker`: `testrail` or `none`. **With `none`, skip every TestRail step below**: the
cases CSV is the only record of the cases and `tr()` carries the row's key.

## 1. Pick the cases

- Cases CSV (`specs/cases/<feature>.csv`, preferred): rows with `decision` = `Keep` (and, with TestRail, a
  `testrail_id`).
  Skip `level` = `unit` rows: they're for the developers' unit tests (listed under "For developers" in the
  plan), not E2E.
  The row has everything the test needs: `background` and `scenario` (Given/When/Then lines; older rows
  have `preconditions`/`steps`/`expected` instead), `data` (loop over its rows), `notes` (test ids, routes,
  stubs), `known_issue` (the `test.fixme()` reason), `file` (where the test goes) and `priority`. With TestRail,
  rows without a `testrail_id` haven't been pushed: run `/qa-kit:push-cases` first. With no tracker, the
  reviewer's `Keep` is the approval. If the feature has a brief, read its `## Decisions` too.
- With TestRail only: a section id (`testrail_get_cases` with that `section_id`), a plan file (its
  `**TestRail:** C…` ids) or case ids (`testrail_get_case` for each). Keep only cases whose `review` is
  `approved` (when a review field is configured) and that are not already automated.

Find existing tests for these cases with `grep -rn "tr(" <testDir>/` (TestRail ids or CSV keys) so you don't
write a second test for the same case. If nothing is left, say so and stop.

## 2. Generate

Create a branch `qa/tests-<feature-slug>`. The generator drives the same guarded browser as the planner:
check `.mcp.json` runs `playwright-test` through `.qa/scripts/mcp-guard.mjs` (`plan-feature` step 3), and if it
runs in the background, start `node .qa/scripts/mcp-guard.mjs --watch --stale=120` next to it. Cases it
reports under "Not explored", or that a stuck run was on, go to the user with AskUserQuestion (hint, explore
by hand, skip, retry) instead of being retried blindly.

Use the **playwright-test-generator** agent, one spec file per
feature, at `<testDir>/<area>/<feature-slug>.spec.ts`. Give it the plan file, the case details and these rules,
which match `CLAUDE.md`:

- Import `test` and `expect` from `../fixtures` (adjust the path), never from `@playwright/test` directly.
- Every test carries its case: `test('shows an error for an expired coupon', { annotation: tr('C1234') }, async ({ page }) => { ... })`,
  with the TestRail id, or with no tracker the row's key (`tr('CO-04')`). This annotation is how results
  reach TestRail and how upkeep matches tests to cases. Don't put the id in the title.
- P1 cases also get `tag: '@smoke'`. When `.qa/config.json` → `areas` is set, every test also gets its
  area's tag, `@area-<name>` (`tag: ['@smoke', '@area-purchases']`), so a PR that changes the area's code
  runs it. The name is the feature's area in `areas`; add the area there first if it's missing.
- Locators: `getByRole`, `getByLabel`, `getByText`, then `getByTestId`. No CSS chains or XPath.
  Use the helpers in `<testDir>/support/` for component-library widgets (for example `antSelect` for
  Ant Design selects) instead of raw clicks on dropdown options.
- **The scenario's lines name the steps**, so the HTML report reads like the case: Given lines are the
  setup (API seeding where possible, or one `test.step('Given ...')`), and each When block with its Then
  block is one step named after the When line:
  `await test.step('When the manager approves order A-17', async () => { /* act, then assert each Then line */ })`.
  Each Then line becomes at least one assertion inside that step. For older rows, name steps after the
  numbered steps instead.
- **Placeholders come from `data`**: a scenario with `<amount>` and `<message>` loops over the `data` rows,
  each row in its own step named with the values filled in (`When Omar enters 0 boxes received`).
- `notes` holds the technical hints (test ids, routes, what to stub); it's guidance, not part of the case.
- **`level` = `api` cases** are Playwright tests with no page: use the `request` fixture (or `apiAs(role)`)
  to set up, act and assert on the responses and the stored result, in the same spec file, with the same
  `tr()` annotation so the result is linked to its case. Put them in a `test.describe('API', ...)` block.
- **Roles:** a case about another role uses `asRole('<role>')` (a page signed in as that role) or
  `apiAs('<role>')` (a request context with that role's session) from the fixtures; role names come from
  `roles` in `.qa/config.json`. The default `page` is the default role.
- **One case = one test**, so each case gets one result. Keep the case's shape
  (playbook: `${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/test-design.md`):
  - journey case (several When/Then pairs) → one test with a `test.step()` per pair, each ending in its
    own assertion, so a failure names the checkpoint;
  - data-table case → one test that loops over the table rows, each row in its own `test.step()` with
    `expect.soft` where later rows are still worth checking after one fails;
  - permission case ("even a direct request is refused") → in one test, act as the lower role through the
    UI with `asRole('<role>')` **and** send the request directly with `apiAs('<role>')` (details in
    `notes`); both must be refused, and a check as the default role (or `asRole('<owner role>')`) proves
    nothing changed.
- Assert **business values**, not presence: read the starting value first (stock on hand, balance,
  count), act, then assert the exact new value computed from the inputs. Check the downstream screen or
  API the case names (dashboard, ledger, report), not only the form.
- Dirty paths are real actions: double-click Save (`dblclick`), submit twice, go back and resubmit, two
  pages on the same record, bad input typed as a user would. Assert there's no duplicate and no half-written record.
- Every test ends with an assertion on the business outcome (an order exists, a total is right, an error
  message is shown), not only that a page loaded. Use `toMatchAriaSnapshot` for regions where structure
  matters.
- No `waitForTimeout`, `page.pause()`, `test.only`, hard-coded credentials or production URLs.
- **Test data through the `data` fixture**, not clicked through setup and not shared seed records:
  `const supplier = await data.create('/api/suppliers', { name: data.name('Supplier') })` creates it
  through the API, with a name unique to the run and worker, and deletes it when the test ends. Records the
  app can't delete get `{ remove: false }` inside a per-run organization (playbook section 8); follow the
  row's `notes`.
- **Outside services** as `notes` says: payments in the provider's test mode with its test cards (never
  live keys); emails and SMS read from the test inbox with `mailbox(request).latest(to, { subject, since })`
  (`<testDir>/support/mailbox.ts`, installed with `--with=mailpit`), each test sending to its own `+tag`
  address; anything else stubbed with `page.route`, with a comment saying what the stub hides.
- **Dates and time with `page.clock`**: `await page.clock.setFixedTime(new Date('2026-01-31T23:59:00'))`
  (or `page.clock.install` plus `fastForward` for expiry and timers) before the page loads, instead of
  waiting or editing data. Time zones and formats through `test.use({ timezoneId, locale })`.

- **Accessibility** (`.qa/config.json` → `a11y` is `true`): `<testDir>/a11y/key-pages.spec.ts` holds one
  test per page of the key journeys in `.qa/business-context.md` ("Key journeys"). If the file is missing
  or lacks a journey's pages (`a11y` was just turned on), add them all now, not only this feature's; then
  add any page this feature adds to a key journey. Each test: `tag: ['@a11y', '@area-<name>']` (the page's
  area, when `areas` is set, so PRs that change it run the check), no case id, open the page in the state a
  user sees it (signed in, data loaded, assert something visible first), then
  `await expectAccessible(page)` from `<testDir>/support/a11y.ts` (installed with `--with=a11y`). It fails
  only on serious and critical issues; never weaken it to pass.

## 3. Verify

```bash
node .qa/scripts/lint-specs.mjs <testDir>/<area>/<feature-slug>.spec.ts
<test command> <testDir>/<area>/<feature-slug>.spec.ts --repeat-each=3
```

Fix lint findings. A test that fails because the app doesn't do what the case says is not a test problem:
mark it `test.fixme()` with the reason, list it in the PR as a possible bug, and draft a `qa:gate-4`
issue with the business impact ("supplier charged twice when approve is double-clicked"). Don't weaken
the assertion. Dirty-path cases are where these show up; that is the point of them.

## 4. Open the PR (Gate 2)

- Commit, push, and open a PR with `gh pr create --label qa:gate-2`.
- PR body: a table of case id (or key), title, file and line, priority; anything marked fixme and why; the
  command to run the tests locally.
- With TestRail, call `testrail_mark_automated` for the cases in the PR.

Tell the user the PR link and how many tests were added.
