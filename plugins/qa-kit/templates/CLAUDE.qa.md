## QA conventions (QA Kit, Playwright E2E)

This repo uses the agency QA Kit: Playwright test agents write and heal end-to-end tests, TestRail is
the system of record, and people review at five gates. Follow these rules in every session.

### App under test

- Never point tests at production. `BASE_URL` set = a staging URL; unset = Playwright starts this
  checkout using `app` in `.qa/config.json`.
- Test user: `QA_USER_EMAIL` / `QA_USER_PASSWORD` (a seeded test account). Never hard-code credentials.
- Roles: ROLE_LIST
- Main areas: AREA_LIST
- Test data: TEST_DATA_NOTES

### Designing test cases

- Think like the owner of this business: read `.qa/business-context.md` first. A case exists to protect
  something the owner would lose (money, stock, access, data, trust), and says so in a "Why it matters" line.
- Acceptance criteria are the required business behaviour, verified against the implementation; a gap
  between the two is a case or an open question, never an expected result.
- Cover the realistic dirty paths (bad input, acting twice or out of order, lower roles via UI and API,
  integrity across features, repeats, dates and money, recovery), not just the happy path.
- No junk: one case per business outcome, journeys with checkpoints over fragments, data tables over
  one-case-per-field. Playbook: `/qa-kit:plan-feature` follows `skills/plan-feature/test-design.md` in the kit.
- **Cases live in `specs/cases/<feature>.csv`, one row per case** (format: `specs/cases/README.md`). Edit the
  CSV, never the generated block in `specs/<feature>.md`; regenerate it with
  `node .qa/scripts/cases.mjs plan <csv>` and validate with `node .qa/scripts/cases.mjs check <csv>`.
  The reviewer's `decision` column is Gate 1; only `Keep` rows reach TestRail, through `/qa-kit:push-cases`.

### Writing tests

- Tests live in `e2e/<area>/<feature>.spec.ts`. Import `test`, `expect` and `tr` from `e2e/fixtures.ts`.
  `e2e/seed.spec.ts` is the seed for the planner and generator agents.
- Every test links to its TestRail case: `test('title', { annotation: tr('C1234') }, async ({ page }) => { ... })`.
  Results reach TestRail only through this annotation. Don't put the case id in the title.
- P1 cases get `tag: '@smoke'`. Flaky tests under investigation get `'@quarantine'` (skipped in CI).
- Locators, in order of preference: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. No XPath, no long CSS chains.
- Assert the business outcome (record created, total correct, error shown), not only that a page loaded.
  Use `toMatchAriaSnapshot` for regions whose structure matters.
- No `waitForTimeout`, `page.pause()` or `test.only`. Rely on auto-waiting and web-first assertions.
- Seed data through the API (`request` fixture) rather than long UI setup.
- Check your work with `node .qa/scripts/lint-specs.mjs <files>` and run new tests with `--repeat-each=3`.

### Agents driving the live browser (planner, generator, healer)

- If clicking an `option` or `listbox` item from the snapshot times out, it is usually a hidden
  accessibility copy (component libraries render these). Don't retry the click: click the field, type
  enough of the option's text to make it unique, and press Enter (ArrowDown + Enter for the next one).
- Dropdown lists are often virtual (only ~10 rows rendered): type to reach anything further down.
- Browser actions have time limits (`.qa/scripts/mcp-guard.mjs`, set in `.qa/config.json` `agents.toolTimeouts`).
  An error starting "QA Kit guard:" means the action would never have finished: never retry the same ref.
  Two attempts per step, then record it under "Not explored" and move on. `.qa-cache/mcp-guard.log` shows
  every browser call and how long it took.

### What needs a person (the gates)

1. Cases are reviewed in the cases CSV (`decision` column, filled by a person, never by Claude) before they
   are pushed. Pushed cases stay "AI draft" in TestRail until the QA lead approves them. Never approve cases yourself.
2. New or changed specs go through a PR labelled `qa:gate-2`.
3. Never change an assertion's matcher or expected value to make a test pass. If behaviour changed,
   mark the test `test.fixme()` with a reason and open a `qa:gate-3` issue.
4. Bugs are drafted as `qa:gate-4` issues; a QA engineer reproduces them before the client sees anything.
5. Release sign-off is the QA lead's call.

### Commands

- `npx playwright test` · `npx playwright test --grep @smoke` · `npx playwright show-report reports/html`
- Kit skills: `/qa-kit:plan-feature`, `/qa-kit:review-cases`, `/qa-kit:push-cases`, `/qa-kit:generate-tests`, `/qa-kit:triage`, `/qa-kit:digest`, `/qa-kit:upkeep`, `/qa-kit:client-report`
