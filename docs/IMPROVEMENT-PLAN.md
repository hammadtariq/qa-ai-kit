# QA Kit improvement plan

Status: **All four phases built (0.6.0 to 0.9.0)**, with the recommended answer for every decision below.

## Why

The kit already designs cases around business risk, prunes junk, keeps people at five gates and leaves
deterministic work to scripts. Four things stop it from being plug-and-play on any project:

1. **It guesses the business instead of asking.** `.qa/business-context.md` is filled from repo docs and
   code, and the owner confirms one list. On repos without good docs, guesses become P1 cases.
2. **Cases read like test scripts.** Numbered steps and expected results drift into UI words (click,
   field, page) and grow long. A non-technical owner can't review them quickly.
3. **The junk filter grades its own work.** The model that writes the cases also prunes them, and every
   case is assumed to be a browser test, even when an API or unit test is the right place for it.
4. **Some automation basics are missing:** one login only (while the playbook asks for per-role cases),
   no test-data cleanup, no pattern for email, payments or dates, Node-only setup, TestRail assumed.

## Goals

- A new project gets a useful business context from a short interview with its owner, not from guesses.
- Every case reads as a short Given/When/Then scenario in the business's own words, checked by a script.
- Cases are fewer: each one is placed at the cheapest test level that can catch it, and an independent
  reviewer scores it before a person sees it.
- The kit works on any web app repo (Node or not, with or without TestRail, one role or many).

## Non-goals

- Running cases through Cucumber. Gherkin is the language of the case; Playwright stays the runner
  (reasons in Phase 1.4). `playwright-bdd` can be an opt-in later.
- Native mobile apps and API-only products. Both are worth doing; neither fits this plan.
- Trackers other than TestRail and "none" (Xray, Qase, Zephyr). Phase 3 makes the tracker a setting so
  they can be added later.

## Decisions for you

Each has a recommendation. Change any you disagree with.

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Where does the Gherkin text live: a `scenario` column in the existing CSV, or `.feature` files? | **CSV column.** The sheet review (Gate 1), `push-cases` and `review-cases` keep working, and owners still review in a spreadsheet |
| D2 | Do old CSVs (steps/expected) keep working? | **Yes, both formats are read.** New files use `scenario`; `cases.mjs migrate` converts on request |
| D3 | How strict is the plain-language check? | **Errors** for clearly technical words (click, button, selector, endpoint, status code, database, xpath, css); **warnings** for borderline ones (page, field, screen, form, dropdown, URL, API) |
| D4 | What happens to cases the reviewer places at `unit` level? | **Not pushed to TestRail.** Listed in the plan under "For developers" so they aren't lost |
| D5 | TestRail BDD template support? | **Not in Phase 1.** Push maps Given/When/Then onto the Steps template, which every instance has; BDD template is a follow-up |
| D6 | Release plan | One minor version per phase (0.6.0 to 0.9.0), each with a CHANGELOG entry and a migration note |
| D7 | Does `/qa-kit:discover` run inside `setup-project`, or separately? | **Separately, and setup calls it at the end.** The owner may not be the person doing setup; it must be re-runnable on its own |

## Phase 1 (0.6.0): Ask the owner, write plain-language cases

### 1.1 New skill: `/qa-kit:discover`

Files: `skills/discover/SKILL.md`, `skills/discover/questions.md` (the question bank).

How it works:

- **Read first, then ask.** Before any question, read the repo (README, docs, routes, models, payment and
  email libraries, roles and permission maps, existing tests) and draft an answer to every question.
- **One question at a time**, with AskUserQuestion. Each question offers 2-4 options, the first being the
  answer drafted from the code, marked "(Recommended)". The owner corrects; they don't write essays.
  Free-text questions only where options make no sense (past incidents).
- **Keep asking about a disaster until it is checkable.** "Payments work" isn't accepted; follow up until
  it is a rule a test can prove, like "a refund never exceeds what was captured".
- **Stop when it's good enough**, not after a fixed count: every area below has an answer, and every
  "must never go wrong" item is a checkable rule. Expect 10-20 questions on a first run.
- **Re-runs ask only about gaps:** facts marked `(assumed)` or older than 6 months.

Question areas, in this order (the bank in `questions.md` holds the wording and follow-ups):

1. What the product is, for whom, and how it makes money (pick a business type: see 1.3).
2. Who uses it day to day, and their roles. Which roles must never do what.
3. The 3 journeys that bring in revenue or that users can't work without.
4. What would be a disaster: money, data, access, legal or compliance, reputation. Ranked.
5. Past incidents and the support complaints that keep coming back.
6. Outside services: payments, email, SMS, sign-in providers, ERPs, webhooks. Is there a sandbox?
7. What the team promises to support: browsers, mobile sizes, languages, currencies, time zones.
8. What unit and API tests already cover (so E2E doesn't repeat it).
9. How often they release, and what a bad release costs.
10. Test environment and data: staging or local, seeded accounts per role, can tests create and delete data.

Output:

- `.qa/business-context.md`, with new sections for areas 6-10 (template updated), and a **source tag** on
  every fact: `(owner, 2026-10-27)`, `(code: src/billing/refund.ts)` or `(assumed)`.
  `plan-feature` uses only `(owner)` facts to justify P1.
- **Risk tier per area** (low / medium / high), used by the case budget in Phase 2.3.
- `.qa/glossary.md` (new template): about 15 business terms with one-line meanings, and the words to
  avoid ("order", not "transaction record"). Cases must use these words.

Changes elsewhere:

- `setup-project` step 6: replace the business-context bullet with "run `/qa-kit:discover`, or tell the
  user to have the product owner run it before the first `plan-feature`".
- `plan-feature` step 0 and `review-cases` step 0: if the context is missing, or a "must never go wrong"
  item is `(assumed)`, run discover (or its short form for that area) before planning.
- `cases.mjs` `loadRisks`: strip the source tag from risk titles.

### 1.2 Feature-level questions in `plan-feature`

Step 1 today says "stop if the business rules are unclear and list the questions". Replace it with the
same interview style, scoped to the feature:

- Read the ticket and the implementation, then ask at most ~6 questions, one at a time, each with a
  recommended answer from the code ("The API allows approving your own purchase. Should it?").
- Record every answer in the brief under a new `## Decisions` section (question, answer, who, date), so
  later sessions and `review-cases` don't ask again. `brief-template.md` gets the section.
- When the owner isn't in the session (a GitHub issue picked up in CI), keep today's behaviour: post the
  questions as one issue comment and stop.

### 1.3 Playbook for any kind of business

`skills/plan-feature/test-design.md`:

- Replace the inventory examples (bales, supplier ledger, Rs) with neutral ones, or one per domain, so the
  model doesn't bring ledger checks to a booking app.
- New folder `skills/plan-feature/risk-packs/`, one short file per business type: `ecommerce`,
  `saas-billing`, `booking`, `marketplace`, `fintech-ledger`, `content-cms`, `internal-admin`,
  `healthcare`. Each is ~10 lines: the usual disasters, the dirty paths users really hit, and the
  downstream screens owners check. Discover picks the packs; they seed questions and are never turned
  into cases directly.
- New section reconciling journeys with Gherkin (see 1.4).
- New section with 4-6 **good / bad case pairs** in Gherkin. Examples change the writing style more than
  rules do.

### 1.4 Gherkin as the case language

**Why not the Cucumber runner:** Cucumber adds step definitions between the case and the code. Generated
step definitions tend to multiply into near-duplicates, and the runner would replace the `tr()`
annotation → JUnit → TestRail path and the healer flow that already work. Gherkin in the CSV gives the
readability without that cost.

CSV changes (`templates/specs/cases/README.md`, `cases.mjs` `COLUMNS`):

| Column | Change |
| --- | --- |
| `scenario` | **New.** Given/When/Then lines, one per line, `And` / `But` allowed |
| `background` | **New, optional.** Given lines shared by the section (written once in the plan) |
| `data` | Unchanged; it is the Scenario Outline's Examples. `<name>` placeholders in the scenario match its header |
| `preconditions`, `steps`, `expected` | Kept for old files. New files leave them empty; `check` accepts either `scenario` or `steps`+`expected` |
| `notes` | Unchanged; the only place for technical hints (test ids, API routes, waits) |

How a scenario maps to everything downstream (so `push-cases` and `generate-tests` barely change):

- `Given` lines → preconditions (then the "Why it matters" line, as today).
- Each `When` block (with its `And` lines) → one step; the `Then` block after it → that step's expected
  result. A journey with 3 When/Then pairs becomes 3 steps, exactly like today's numbered steps.
- `testrailSteps()` and `buildPayload()` read the scenario when present; TestRail text keeps the
  Given/When/Then words so it reads the same in both places.
- Generated specs use the scenario lines as step names:
  `await test.step('When the manager approves the order', ...)`, so the HTML report reads like the case.

Writing rules (playbook), enforced by `cases.mjs check`:

| Rule | Check |
| --- | --- |
| Business words, no technical words | Error on the D3 error list, warning on the borderline list, in `title` and `scenario` (not `notes`) |
| Title of 12 words or fewer | Warning |
| 3-7 lines per scenario | Warning above 7 |
| One action per scenario; a journey may have up to 4 When/Then pairs | Error above 4 pairs: split it |
| Every `Then` shows something a person can see: a number, a status, a quoted message, or who can see what | Warning when a Then has none of these, or uses "correctly", "properly", "as expected", "works" |
| Starts with Given, every When is followed by a Then | Error |
| Uses glossary terms | Warning for a capitalised noun that isn't in `.qa/glossary.md` (off when there is no glossary) |

Permission cases about direct requests are phrased in business terms ("Then even a direct request to
refund is refused"), with the request details in `notes`.

Example:

```gherkin
Scenario: A refund can never be more than the customer paid
  Given Ali paid 5,000 for order A-17
  When the store manager refunds 6,000
  Then the refund is refused with "Refund is more than the amount paid"
  And order A-17 still shows 5,000 paid and nothing refunded
```

### 1.5 Migration

- `node .qa/scripts/cases.mjs migrate <csv>`: converts preconditions/steps/expected into `scenario`
  (Given from preconditions, When from each step, Then from its expected result), and sets
  `suggestion` to `Rewrite: converted to Given/When/Then, check the wording` on every converted row. It
  never touches `decision` or `testrail_id`.
- `from-plan` writes `scenario` for new files.
- Old files keep working without migration.

### 1.6 Skills that change

| Skill | Change |
| --- | --- |
| `plan-feature` | Step 0 uses discover; step 1 asks feature questions (1.2); planner instructions ask for Gherkin wording; step 4 fills `scenario` |
| `review-cases` | Judges wording against the new rules; `Rewrite` covers "technical wording" and "too long" |
| `push-cases` | No skill change; payload already comes from `cases.mjs` |
| `generate-tests` | Step names from scenario lines; data rows from `data` placeholders |
| `setup-project` | Installs `glossary.md`; calls discover at the end (D7) |
| `CLAUDE.qa.md` | "Designing test cases" section points to the Gherkin rules and the glossary |

### Done when

- On a repo with no product docs, discover produces a business context with no `(assumed)` disaster in
  under 20 questions.
- `cases.mjs check` flags a case with "click the Save button" (error) and "the total is correct" (warning).
- A migrated CSV pushes to TestRail with the same case ids, and unchanged rows aren't re-sent.
- New script tests (`node --test`, no dependencies; the kit has none today) cover `scenario` parsing, the
  TestRail mapping, the checks and `migrate`, plus the existing steps/expected path so old files are
  proven to still work.

## Phase 2 (0.7.0): Fewer, stronger cases

### 2.1 Test level per case

New CSV column `level`: `ui` (default), `api` or `unit`.

- Playbook rule: **place each check at the cheapest level that can catch it.** A 20-row validation table
  is an `api` case (Playwright `request`), plus at most one `ui` case proving the message reaches the user.
  Pure calculation rules (tax, rounding) with no screen or stored record involved are `unit`.
- `api` cases are generated as Playwright tests using `request`, so they still report to TestRail.
- `unit` cases are held back from push (D4) and listed in the plan under "For developers".
- `check` warns when a `ui` case has a `data` table of more than 5 rows.

### 2.2 Independent scoring before the person sees the cases

In `plan-feature` step 5 (and as an option in `review-cases`), run a subagent with fresh context. It gets
only the CSV, the business context, the glossary and a rubric, not the planning conversation. It scores
every row:

| Score | Scale |
| --- | --- |
| Impact: what the owner loses | 1 cosmetic, 2 recoverable, 3 money / data / access / legal |
| Likelihood: how plausible in real use | 1 rare, 2 occasional, 3 common |
| Unique: does another row already catch this | yes / no |
| Observable: can a person check the Then | yes / no |

Rows with impact 1 (unless the owner asked for it) or impact × likelihood under 3 get `suggestion` = `Drop`;
rows that aren't unique get `Merge into KEY`; each with the reviewer's reason. Rows that aren't observable get
`Rewrite: not observable`: the risk may be real, only the Then needs to say what a person sees. (Impact 1 was
added after the first trial: a cosmetic case scored 1×3 = 3 and survived the product rule.) P1 needs impact 3,
else `Rewrite` to P2. The scores go in a new `score` column (for example
`3x2`) so the reviewer sees why. The person still decides in the `decision` column.

### 2.3 Case budget by risk

Replace the flat 8-15:

- `.qa/config.json` → `cases.budget`: `{ "low": 6, "medium": 12, "high": 20 }` (defaults).
- The feature's tier comes from the area's tier in the business context (Phase 1.1), noted in the brief.
- `cases.mjs check --tier=<tier>` warns above the budget, and the warning names the lowest-scoring rows.

### 2.4 One login per role

Today there's one login (`QA_USER_EMAIL`), while permission cases need several.

- `.qa/config.json` → `roles`: `{ "admin": { "env": "QA_ADMIN" }, "staff": { "env": "QA_STAFF" } }`,
  reading `QA_ADMIN_EMAIL` / `QA_ADMIN_PASSWORD` and so on. With no `roles`, today's single user is the
  default role, so existing projects keep working.
- `e2e/auth.setup.ts` logs in once per role and saves `playwright/.auth/<role>.json`.
- `e2e/fixtures.ts` adds `asRole(role)` (a page in that role's session) and `apiAs(role)` (a `request`
  context with that role's session) for the "UI and direct request" permission cases.
- `setup-project`, `qa.env.example` and the CI secrets table list one pair per role; discover (area 10)
  asks which seeded accounts exist.

### Done when

- On a sample feature, the scored set is smaller than the unscored one, with every dropped row's reason
  in the sheet.
- A permission case runs as two roles in one test, in the UI and as a direct request.

## Phase 3 (0.8.0): Works on any project

### 3.1 Test data that cleans up after itself

- Template fixture `data` in `fixtures.ts`: create records through the API and register each one for
  deletion when the test ends, with names unique per run and per worker (`testInfo.parallelIndex`).
- Playbook: when the app can't delete (ledgers, audit logs), use a per-run organization or tenant instead.
- `generate-tests`: use the fixture rather than ad-hoc setup.

### 3.2 Outside services, dates and time

New playbook section, and rules in `generate-tests`:

- **Payments:** the provider's test mode and published test cards, never live keys.
- **Email and SMS:** a test inbox (Mailpit locally, Mailosaur or similar on staging), with an optional
  `mailbox` fixture template.
- **Anything else:** `page.route` to stub the outside call, stating in `notes` what the stub hides.
- **Dates:** `page.clock` for month end, expiry and time zones, instead of waiting or changing data.

Discover (area 6) records which of these each project has.

### 3.3 Repos without Node

`setup-project` step 1 stops on a missing `package.json`. Add a **standalone mode**:

- `install-templates.mjs --standalone`: puts Playwright in `qa/` with its own `package.json` and
  lockfile; `.qa/` stays at the repo root; `testDir` becomes `qa/e2e`.
- The app is reached by `BASE_URL`, or started by `app.startCommand` as any shell command
  (`bin/rails s`, `python manage.py runserver`).
- Workflows get `working-directory: qa` and install Node only for the tests.

### 3.4 Tracker as a setting

- `.qa/config.json` → `tracker`: `"testrail"` (default when `testrail.projectId` is set) or `"none"`.
- With `"none"`: `push-cases` is skipped, specs use the CSV key (`tr('PO-07')`), `lint-specs` accepts keys
  as ids, results stay in the Playwright report and JUnit file, and `upkeep` compares the CSV with the code.
- Each skill's TestRail steps are wrapped in one "if the tracker is TestRail" line, so adding another
  tracker later is a contained change.

### 3.5 Browsers and devices from the contract

Discover (area 7) records the browsers, mobile sizes and languages; `setup-project` adds the matching
Playwright projects (`webkit`, `Mobile Safari`, a locale project) instead of Chromium only. P1 journeys run
on all of them; the rest on Chromium.

As built (0.8.0), with small changes from the draft above: names from `data.name()` use the worker index
(unique even when a worker restarts) rather than `parallelIndex`; the `mailbox` helper is an install extra
(`--with=mailpit`); browsers are a `browsers` setting the config turns into projects, so setup edits JSON, not
TypeScript; standalone commands run from the root as `qa/node_modules/.bin/playwright test -c qa`, and the CI
action exports them as `QA_TEST` instead of setting `working-directory`.

### Done when

- `setup-project` completes on a small non-Node sample app in standalone mode.
- A project with `tracker: "none"` goes from plan to passing tests without TestRail credentials.

## Phase 4 (0.9.0): Extras and checking the kit itself

### 4.1 Accessibility (opt-in)

`@axe-core/playwright` smoke tests on the pages of the key journeys from the business context, tagged
`@a11y`, failing only on serious and critical issues. Turned on by discover's answer or by the user.

### 4.2 Run only what a PR touches

- `.qa/config.json` → `areas`: `{ "purchases": ["src/purchases/**", "app/api/purchases/**"] }`.
- `generate-tests` tags tests `@area-<name>`.
- The PR workflow runs `@smoke` plus the areas whose paths the PR changed; nightly still runs everything.

### 4.3 Checks for the skills

Prompt changes today ship untested. Add `evals/`:

- A small sample app with known bugs, three tickets, and the owner's answers written down, so discover
  and plan-feature can run without a person.
- Checks on the output: `cases.mjs check` has no errors, the case count is within budget, every
  "must never go wrong" risk the ticket touches has a case, no two cases share a title meaning, and a
  rubric judge scores readability for a non-technical reader.
- Run with `claude plugin eval` (confirm its suite format before building) on every change to `skills/`.

### Done when

- The eval suite runs in CI on PRs that touch `skills/` or `templates/.qa/scripts/`.

As built (0.9.0), with small changes from the draft above:

- Accessibility is an install extra (`--with=a11y`, `expectAccessible(page)`) plus `"a11y": true`. Its tests
  live in one `<testDir>/a11y/key-pages.spec.ts` with no case id, one per key-journey page from the business
  context, written by `generate-tests` (all journeys on its first run with `a11y` on). Each carries the
  page's `@area-<name>`, so a PR runs it when it changes that area; they are not `@smoke`.
- Areas are path globs (`**`, `*`, `?`, `{a,b}`, `[ab]`) matched by `.qa/scripts/areas.mjs`, no dependency.
  Files in no area add nothing beyond `@smoke`. When git can't list the changed files, the PR runs `@smoke`
  with a warning. `lint-specs` warns on a test without an area tag.
- `claude plugin eval` has no script graders. "`cases.mjs check` has no errors" is a regex on the run's
  trace: the last `check` output must say 0 errors, and the run is told to end with `check`. That is close
  to, but not the same as, running `check` on the final CSV. Budget, risk coverage, duplicates and
  readability are judged on the CSV. CI fails on any failed deterministic grader even above the 0.8 score.
  The sample app has two known bugs per ticket, and a `no-peeking` grader fails a run that reads the suite.
- The eval runs are unattended and have no browser, so `plan-feature` plans from the code, not the planner
  agent; browser exploration isn't covered. Fork PRs skip the evals (no secrets).

## Risks

| Risk | Mitigation |
| --- | --- |
| The CSV format change breaks existing projects | Both formats are read (D2); migration is opt-in and leaves ids and decisions alone |
| The interview feels long to owners | Recommended answers from the code, multiple choice, stop when good enough, re-runs only ask about gaps |
| The word check blocks honest wording | Borderline words are warnings; `notes` is never checked |
| The scoring subagent adds cost | One call per feature, on the CSV only (no browser, no planning history) |
| Role logins multiply secrets | One pair per role, only for roles discover says exist; default stays one user |

## Order of work inside Phase 1

1. Script tests for today's `cases.mjs` behaviour first, then the `scenario` and `background` columns,
   mapping, checks and `migrate`.
2. Playbook rewrite, good/bad pairs, risk packs.
3. `discover` skill and question bank; business-context and glossary templates.
4. `plan-feature`, `review-cases`, `generate-tests`, `setup-project` and `CLAUDE.qa.md` changes.
5. README flow, CHANGELOG 0.6.0, migration note.
