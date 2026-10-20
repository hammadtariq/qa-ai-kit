# CLIENT_PROJECT_NAME

<!-- /qa-kit:setup-project fills the placeholders. Keep this file short: it loads into every session. -->

## QA conventions

This repo uses the agency QA Kit: Playwright test agents write and heal tests, TestRail is the
system of record, and people review at five gates. Follow these rules in every session.

### App under test
- Staging URL comes from `BASE_URL`. Never point tests at production.
- Test user: `QA_USER_EMAIL` / `QA_USER_PASSWORD` (seeded staging account). Never hard-code credentials.
- Roles: ROLE_LIST
- Main areas: AREA_LIST

### Writing tests
- Tests live in `tests/<area>/<feature>.spec.ts`. Import `test`, `expect` and `tr` from `tests/fixtures.ts`.
- Every test links to its TestRail case: `test('title', { annotation: tr('C1234') }, async ({ page }) => { ... })`.
  Results reach TestRail only through this annotation. Don't put the case id in the title.
- P1 cases get `tag: '@smoke'`. Flaky tests under investigation get `'@quarantine'` (skipped in CI).
- Locators, in order of preference: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. No XPath, no long CSS chains.
- Assert the business outcome (record created, total correct, error shown), not only that a page loaded.
  Use `toMatchAriaSnapshot` for regions whose structure matters.
- No `waitForTimeout`, `page.pause()` or `test.only`. Rely on auto-waiting and web-first assertions.
- Seed data through the API (`request` fixture) rather than long UI setup.
- Check your work with `node .qa/scripts/lint-specs.mjs <files>` and run new tests with `--repeat-each=3`.

### What needs a person (the gates)
1. New TestRail cases stay "AI draft" until the QA lead approves them. Never approve cases yourself.
2. New or changed specs go through a PR labelled `qa:gate-2`.
3. Never change an assertion's matcher or expected value to make a test pass. If behaviour changed,
   mark the test `test.fixme()` with a reason and open a `qa:gate-3` issue.
4. Bugs are drafted as `qa:gate-4` issues; a QA engineer reproduces them before the client sees anything.
5. Release sign-off is the QA lead's call.

### Commands
- `npx playwright test` · `npx playwright test --grep @smoke` · `npx playwright show-report reports/html`
- Kit skills: `/qa-kit:plan-feature`, `/qa-kit:generate-tests`, `/qa-kit:triage`, `/qa-kit:digest`, `/qa-kit:upkeep`, `/qa-kit:client-report`
