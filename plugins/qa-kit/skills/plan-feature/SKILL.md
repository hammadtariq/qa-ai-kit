---
name: plan-feature
description: Turn a story or ticket into an explored test plan and AI-draft TestRail cases for QA lead approval (Gate 1). Use when a story reaches Ready for QA, or the user asks to plan or write test cases for a feature.
argument-hint: "<ticket id, issue URL or short feature description>"
disable-model-invocation: true
---

# Plan tests for a feature

Feature: `$ARGUMENTS`

Plan one feature per session; start a fresh session for the next one so context stays small.

## 1. Get the acceptance criteria

- GitHub issue number or URL: `gh issue view <n> --json title,body,labels,comments`.
- Any other tracker: ask the user to paste the story and acceptance criteria if they're not in the message.
- If the PR for the feature is known, read its diff summary (`gh pr diff <n> --name-only`) to see which
  pages and components changed.

**Stop if the criteria are unclear.** List the specific questions (missing rules, undefined edge cases,
contradictions). For a GitHub issue, post them as one comment with `gh issue comment`; otherwise give
them to the user. Do not guess business rules.

## 2. Avoid duplicates

Call `testrail_get_sections`, then `testrail_get_cases` for the closest section. Note existing cases that
already cover parts of this feature; the plan should add to them, not repeat them.

## 3. Explore and write the plan

Use the **playwright-test-planner** agent. Give it:

- the feature name and the acceptance criteria, verbatim
- the seed test `tests/seed.spec.ts` (it logs in through the shared fixtures)
- the output file `specs/<feature-slug>.md`
- these instructions: cover every acceptance criterion; include negative paths, validation, permissions
  per role and empty states; skip anything existing cases already cover; mark each scenario P1 (blocks
  release), P2 or P3.

Read the plan it writes. Remove scenarios that are vague ("works correctly") or that can't be checked
from the UI or API. Keep each scenario to one behaviour.

## 4. Create the TestRail cases

- Create or reuse a section named after the feature (`testrail_add_section`, under the area's parent section
  if there is one).
- Call `testrail_get_meta` once to map P1/P2/P3 to `priority_id` and pick `type_id` (Functional, Regression,
  Security, Accessibility...).
- Create all cases in **one** `testrail_add_cases` call: title = the behaviour ("Shows an error when the
  coupon has expired"), `refs` = the ticket id, separated steps with an expected result each, preconditions
  for required data or role.
- Write the case id next to each scenario in `specs/<feature-slug>.md`, like `**TestRail:** C1234`.

## 5. Report for Gate 1

Tell the user in a few lines: how many cases were created by priority, which acceptance criterion each
covers, anything left out and why, and the TestRail review link from the tool result.
The cases stay "AI draft" until the QA lead approves them in TestRail. Then run `/qa-kit:generate-tests`.
