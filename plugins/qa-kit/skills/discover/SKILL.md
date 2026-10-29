---
name: discover
description: Interview the product owner, one multiple-choice question at a time, to fill .qa/business-context.md and .qa/glossary.md - what the product is, who uses it, the journeys that matter, what must never go wrong (as rules a test can check), outside services, support promises, existing tests, releases and test data. Every answer is drafted from the repo first, so the owner corrects rather than writes. Use on a new project before the first plan-feature, when the context is missing or has (assumed) facts, when the user asks to set up or refresh the business context, or with an area name to ask about just that area.
argument-hint: "[area to ask about only, e.g. disasters, roles, services; empty = all gaps]"
---

# Discover the business

Area: `$ARGUMENTS` (empty: every area that has a gap).

This skill turns what the owner knows into `.qa/business-context.md` and `.qa/glossary.md`. Every plan,
case priority and bug severity in the kit is judged against them, so a fact the owner never confirmed
can't justify a P1. The question bank, with wording, follow-ups and when an area counts as answered, is
`${CLAUDE_PLUGIN_ROOT}/skills/discover/questions.md`.

**Who answers:** the product owner, or someone who can speak for the business (founder, account manager,
QA lead with the owner's notes). If the person in the session is doing technical setup and can't answer,
say so, write the drafts tagged `(assumed)`, and give them the command to hand over:
`/qa-kit:discover` run by the owner. Never present a guess as the owner's answer.

## 1. Read first, then ask

Before any question, read the repo and draft an answer to every question in the bank:

- `README*`, `docs/`, PRDs, `CLAUDE.md`, marketing copy or landing pages in the repo;
- routes and pages (what the product lets people do), models and migrations (the records it keeps);
- roles and permission maps, middleware, policy files;
- payment, email, SMS, sign-in and webhook libraries in the dependencies and their config;
- existing unit, API and E2E tests (what is covered already) and CI workflows (how often it releases);
- seed scripts and fixtures (which accounts and data exist for tests);
- an existing `.qa/business-context.md` and `.qa/glossary.md`.

Pick the matching risk packs from `${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/risk-packs/` (more than one is
fine). Use them to draft the disasters and the follow-up questions; they are never copied in as facts.

Keep notes of where each draft came from (`code: src/billing/refund.ts`); that becomes its source tag if
the owner doesn't change it.

## 2. Ask one question at a time

Use AskUserQuestion with **one question per call**, so each answer can shape the next question.

- 2-4 options. The first is the answer drafted from the repo, labelled `(Recommended)`, with the evidence
  in its description ("Stripe is in package.json and src/billing/"). The owner picks or corrects; "Other"
  is always there for their own words.
- Use `multiSelect` for lists (roles, outside services, browsers).
- Free text only where options make no sense (past incidents): ask in plain chat and wait.
- Plain words. The owner may not be technical: "Which payment provider takes the money?", not "Which PSP
  SDK is integrated?".
- Say how far along you are now and then ("about 6 more questions").

**Keep asking about a disaster until it is checkable.** "Payments must work" isn't a rule. Offer drafted
rules as options until it is one a test can prove: "A refund never exceeds what was captured", "A customer
is charged once per order, even if they pay twice". The bank has follow-ups for each kind of disaster.

**Stop when it's good enough,** not after a fixed count: every area has an answer, and every "must never
go wrong" item is a checkable rule tagged `(owner, ...)`. Expect 10-20 questions on a first run. If the
owner wants to stop early, write what you have, tag the rest `(assumed)`, and say which areas are open.

**Re-runs ask only about gaps:** facts tagged `(assumed)`, facts older than 6 months (by their tag's
date), placeholders left from the template, and areas with no answer. With an area in `$ARGUMENTS`, ask
only about that area (its short form). Confirm, don't re-ask, facts that are still current.

**No owner in the session** (a CI run, an unattended agent): don't ask. Write the drafts tagged `(assumed)`,
list the open questions at the end of the context under `## Open questions for the owner`, and report
them. `plan-feature` will not use `(assumed)` facts to justify a P1.

## 3. Write the context

`.qa/business-context.md` follows the template's sections (copy it from
`${CLAUDE_PLUGIN_ROOT}/templates/.qa/business-context.md` if the file is missing). Rules:

- **A source tag on every fact**, at the end of its line: `(owner, YYYY-MM-DD)` for what the owner
  confirmed or said, `(code: path)` for what you read and the owner didn't contest, `(assumed)` for a draft
  nobody confirmed. Use today's date.
- **"What must never go wrong" is ranked**, one checkable rule per line, bold rule first:
  `1. **A refund never exceeds what was captured.** Refunds are manual and staff are rushed. (owner, 2026-10-27)`.
  Ranks are referenced by the `risks` column of every cases CSV, so when re-ranking an existing list, keep
  the old numbers where you can and tell the user which CSVs reference a rank that moved
  (`grep -l` the `risks` column in `specs/cases/*.csv`).
- **Areas and risk tiers:** one row per product area (purchases, billing, bookings...) with `low`,
  `medium` or `high` and the reason. High: money, access or data loss is possible there. Medium: wrong but
  recoverable. Low: cosmetic or rarely used. The case budget per feature comes from this tier.
- **Outside services:** the "In tests" column says how tests deal with each one (playbook section 8):
  `test mode` (payments with test cards), `test inbox` (email and SMS, Mailpit or Mailosaur), `stub`
  (anything with no sandbox), or `unknown`.
- Keep it to about one page. It's read before every plan.

## 4. Settings from the answers

- **Browsers and devices (area 7):** if the owner named more than desktop Chrome, set `.qa/config.json` →
  `browsers` with Playwright's device names and locales, e.g.
  `{ "devices": ["Desktop Safari", "iPhone 13"], "locales": ["ar-SA"] }` (Safari on iPhone → `"iPhone 13"`,
  Chrome on Android → `"Pixel 7"`, Safari on desktop → `"Desktop Safari"`, Firefox → `"Desktop Firefox"`,
  Edge → `"Desktop Edge"`). These run the P1 journeys (`@smoke`); everything runs on desktop Chrome.
- **Accessibility (area 7):** "required" or "we'd like to" → `"a11y": true` in `.qa/config.json`. If the
  project has no `<testDir>/support/a11y.ts`, tell the user to re-run the installer with `--with=a11y`.
  Each page of a key journey then gets an axe check (`@a11y`) when its feature's tests are written.
- **Areas (Areas and risk tiers):** for each area in the table, set `.qa/config.json` → `areas` with the
  source folders that belong to it, read from the code (`"purchases": ["src/purchases/**",
  "app/api/purchases/**"]`, names in lower case with dashes). Leave out shared code (layouts, auth, utils);
  `@smoke` covers it. PRs then run the tests of the areas they change.
- **Email or SMS through a test inbox (area 6):** if the project has no `<testDir>/support/mailbox.ts`, tell
  the user to re-run the installer with `--with=mailpit` (see `/qa-kit:setup-project` step 4).
- **Cleanup (area 10):** "create only" or "separate test organization" means tests can't delete what they
  make; note it under Test environment and data so plans use a per-run organization (playbook section 8).

## 5. Write the glossary

`.qa/glossary.md` (template: `${CLAUDE_PLUGIN_ROOT}/templates/.qa/glossary.md`): about 15 business terms
with a one-line meaning in the owner's words, the words to avoid for each ("Order", not "transaction
record"), and the names used in examples (people and records that appear in cases). Draft terms from the
models, page titles and the owner's own answers; ask one question to confirm the list and the avoided
words. `cases.mjs check` warns when a case uses an avoided word or a capitalised word that isn't here.

## 6. Finish

- Show the user a short summary: the top disasters as rules, the high-risk areas, anything still
  `(assumed)`, and the open questions.
- If the repo uses branches and PRs, commit both files (`docs(qa): business context from owner interview`)
  on the current branch or a new `qa/business-context` branch.
- Next step: `/qa-kit:plan-feature <feature>`.
