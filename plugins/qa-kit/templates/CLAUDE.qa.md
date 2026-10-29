## QA conventions (QA Kit, Playwright E2E)

This repo uses the agency QA Kit: Playwright test agents write and heal end-to-end tests, the cases CSV
(and TestRail, when `tracker` in `.qa/config.json` is `testrail`) is the system of record, and people
review at five gates. Follow these rules in every session.

### App under test

- Never point tests at production. `BASE_URL` set = a staging URL; unset = Playwright starts this
  checkout using `app` in `.qa/config.json`.
- Test logins: one seeded account per role in `.qa/config.json` `roles` (`<env>_EMAIL` / `<env>_PASSWORD`),
  or `QA_USER_EMAIL` / `QA_USER_PASSWORD` when there are no roles. Never hard-code credentials. Tests start
  as the default role; `asRole('<role>')` and `apiAs('<role>')` from the fixtures give a page or a request
  context signed in as another role.
- Roles: ROLE_LIST
- Main areas: AREA_LIST
- Test data: TEST_DATA_NOTES

### Designing test cases

- Think like the owner of this business: read `.qa/business-context.md` and `.qa/glossary.md` first (filled
  by `/qa-kit:discover`; only facts tagged `(owner, ...)` justify a P1). A case exists to protect something
  the owner would lose (money, stock, access, data, trust), and says so in a "Why it matters" line.
- Acceptance criteria are the required business behaviour, verified against the implementation; a gap
  between the two is a case or an open question, never an expected result.
- Cover the realistic dirty paths (bad input, acting twice or out of order, lower roles via UI and API,
  integrity across features, repeats, dates and money, recovery), not just the happy path.
- No junk: one case per business outcome, journeys with checkpoints over fragments, data tables over
  one-case-per-field. Each case sits at the cheapest `level` that catches it (`ui`, `api`, or `unit` for the
  developers), the set stays within the area's risk-tier budget, and a fresh reviewer scores every case
  (impact x likelihood) before Gate 1. Playbook: `/qa-kit:plan-feature` follows `skills/plan-feature/test-design.md` in the kit.
- **Each case is a short Gherkin scenario in the business's words** (`scenario` column): Given where it
  starts, When the person does one business action, Then what a person can see (a number, a status, a
  quoted message, who can see what). 3-7 lines, glossary terms, no click / button / field / page /
  endpoint / status code; technical hints go in `notes`. A journey has at most 4 When/Then pairs.
  `cases.mjs check` enforces this. Rules and good / bad examples: the playbook, sections 5-7.
- **Cases live in `specs/cases/<feature>.csv`, one row per case** (format: `specs/cases/README.md`). Edit the
  CSV, never the generated block in `specs/<feature>.md`; regenerate it with
  `node .qa/scripts/cases.mjs plan <csv>` and validate with `node .qa/scripts/cases.mjs check <csv>`.
  The reviewer's `decision` column is Gate 1; with TestRail, only `Keep` rows reach it, through
  `/qa-kit:push-cases`. `node .qa/scripts/cases.mjs tracker` says which tracker this repo uses.

### Writing tests

- Tests live in `e2e/<area>/<feature>.spec.ts`. Import `test`, `expect` and `tr` from `e2e/fixtures.ts`.
  `e2e/seed.spec.ts` is the seed for the planner and generator agents.
- Every test links to its case: `test('title', { annotation: tr('C1234') }, async ({ page }) => { ... })` with
  the TestRail id, or `tr('PO-07')` with the CSV row's key when there is no tracker. Results reach TestRail
  only through this annotation. Don't put the case id in the title.
- P1 cases get `tag: '@smoke'`. Flaky tests under investigation get `'@quarantine'` (skipped in CI).
- With `areas` in `.qa/config.json`, every test also gets `@area-<name>` for its feature's area; a PR runs
  `@smoke`, the tests it changed and the areas whose paths it changed (`node .qa/scripts/areas.mjs`).
- Locators, in order of preference: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. No XPath, no long CSS chains.
- Assert the business outcome (record created, total correct, error shown), not only that a page loaded.
  Use `toMatchAriaSnapshot` for regions whose structure matters.
- No `waitForTimeout`, `page.pause()` or `test.only`. Rely on auto-waiting and web-first assertions.
- Test data through the `data` fixture: `data.create('/api/suppliers', { name: data.name('Supplier') })`
  creates it through the API with a name unique to the run and worker, and deletes it after the test. Never
  change shared seed records; records the app can't delete live in a per-run organization.
- Outside services: payments in the provider's test mode, emails and SMS from the test inbox
  (`mailbox` helper in `e2e/support/`, when installed), anything else stubbed with `page.route` and a comment
  saying what the stub hides. Never live keys.
- Dates and time with `page.clock` (month end, expiry, renewals) and `timezoneId` / `locale`, never by
  waiting or editing data.
- Permission cases: in one test, the lower role through the UI (`asRole`) and by a direct request (`apiAs`);
  both refused, and nothing changed. `level: api` cases use `request` / `apiAs` only, no page.
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
- Extra browsers and devices (`browsers` in `.qa/config.json`) run only the `@smoke` tests; `--project=chromium`
  runs desktop Chrome alone.
- Kit skills: `/qa-kit:discover`, `/qa-kit:plan-feature`, `/qa-kit:review-cases`, `/qa-kit:push-cases`, `/qa-kit:generate-tests`, `/qa-kit:triage`, `/qa-kit:digest`, `/qa-kit:upkeep`, `/qa-kit:client-report`
