---
name: plan-feature
description: Turn a story, ticket or feature brief into business-first test cases - explored in the live app, checked against the implementation, with realistic dirty paths and no junk - as AI-draft TestRail cases for QA lead approval (Gate 1). Use when a story reaches Ready for QA, when adding regression coverage to an existing feature, or when the user asks to plan or write test cases for a feature.
argument-hint: "<ticket id, issue URL, brief file (specs/briefs/x.md) or short feature description>"
disable-model-invocation: true
---

# Plan tests for a feature

Feature: `$ARGUMENTS`

Plan one feature per session; start a fresh session for the next one so context stays small.
Read the QA conventions in `CLAUDE.md` (test folder, logins, UI library notes) and the playbook
`${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/test-design.md`. The playbook decides which cases exist.

## 0. Business context

Read `.qa/business-context.md`. If it is missing or still has placeholders, fill it in first, from the
repo's product docs (README, PRD, product or strategy notes, CLAUDE.md) and the domain models. Ask the
user to confirm the "What must never go wrong" list; it drives every P1 case. Keep it to one page.

## 1. Required business behaviour

- A brief file (for example `specs/briefs/purchase-orders.md`): read it.
- GitHub issue number or URL: `gh issue view <n> --json title,body,labels,comments`.
- Any other tracker: ask the user to paste the story and acceptance criteria if they're not in the message.
- If the PR for the feature is known, read its diff summary (`gh pr diff <n> --name-only`).

**Existing feature with no ticket:** draft `specs/briefs/<feature>.md` from
`${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/brief-template.md`, written as the business owner would
state the rules, then have the user confirm it before you continue.

**Verify against the implementation** in both cases: read the feature's API handlers, validation
schemas, permission maps, state transitions and side effects (ledger entries, stock movements, emails,
history). Note every place the code can disagree with the business rule (a check only in the UI, an
unguarded status change, a side effect not reversed, rounding, a missing tenant filter). Each gap becomes a
case, and if it already looks wrong, an **Open question**. Never write current behaviour that looks wrong
as the expected result.

**Stop if the business rules are unclear.** List the specific questions. For a GitHub issue, post them as
one comment with `gh issue comment`; otherwise give them to the user. Do not guess business rules.

## 2. Avoid duplicates

Call `testrail_status` (its `warnings` must be empty; fix `.qa/config.json` first if not), then
`testrail_get_sections` and `testrail_get_cases` for the closest section. Note existing cases that
already cover parts of this feature; the new set adds to them, it doesn't repeat them.

## 3. Explore and write the plan

Make sure the app is reachable first: `BASE_URL`, or the local dev server from `app.devCommand` in
`.qa/config.json` (start it in a separate terminal so the agent doesn't wait on a cold compile).

Use the **playwright-test-planner** agent. Give it:

- the business context's "What must never go wrong" list and the feature's rules, verbatim
- the implementation gaps you found in step 1
- the seed test `<testDir>/seed.spec.ts` (`testDir` from `.qa/config.json`)
- the output file `specs/<feature-slug>.md`
- these instructions: design from business risks, not screens; for each risk explore the happy path
  and the realistic dirty paths from the playbook (bad input, state abuse, permission abuse through UI and
  API, integrity across features, repeats, time and money, recovery) and check the downstream screens the
  owner would look at; record concrete values (amounts, quantities, statuses) for expected results; skip
  anything existing cases already cover and any open question until the QA lead answers it; follow the UI
  notes in CLAUDE.md. If clicking a dropdown option times out, it's a hidden accessibility copy: type the
  option's text in the field and press Enter instead of retrying the click.

## 4. Prune to a strong set

Apply the playbook's "No junk" rules to the plan before anything reaches TestRail:

- merge per-field validation into one case with a data table, and per-role checks of one action into one case;
- turn fragments of one business chain into a journey case with checkpoints;
- drop page-loads, button-exists and duplicate cases, and anything that can't realistically fail;
- aim for 8–15 cases; every case beyond that must name a risk the others don't cover;
- give each surviving case a business-impact priority (P1 money/stock/access/data loss in a common flow,
  P2 wrong but recoverable or rare, P3 cosmetic).

Update `specs/<feature-slug>.md` to match, with a short "Merged / dropped" list at the end.

## 5. Create the TestRail cases

- Create or reuse a section named after the feature (`testrail_add_section`, under the area's parent section
  if there is one).
- Call `testrail_get_meta` once to map P1/P2/P3 to `priority_id` and pick `type_id` (Functional for
  behaviour, Security for permission/tenant cases, Regression for journeys guarding existing behaviour).
- Create all cases in **one** `testrail_add_cases` call:
  - title = the business behaviour in the owner's words;
  - `preconditions` = data and role, then a line `Why it matters: <business risk>`;
  - separated steps with a checkable expected result each, including downstream screens and concrete values;
  - data tables (inputs → expected result) inside the step text when one case checks several inputs;
  - `refs` = the ticket id, if any.
- Write the case id next to each scenario in `specs/<feature-slug>.md`, like `**TestRail:** C1234`.

## 6. Report for Gate 1

Tell the user, briefly:

1. a **risk → case** table (which business risks are covered, by which cases, at what priority);
2. risks **not** covered and why;
3. cases merged or dropped, one line each;
4. open questions, including anything in the implementation that looked wrong;
5. the TestRail review link from the tool result.

The cases stay "AI draft" until the QA lead approves them in TestRail. Then run `/qa-kit:generate-tests`.
