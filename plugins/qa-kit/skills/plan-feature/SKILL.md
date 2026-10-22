---
name: plan-feature
description: Turn a story, ticket or feature brief into business-first test cases - explored in the live app, checked against the implementation, with realistic dirty paths and no junk - written to a cases CSV (one row per case) for the reviewer to judge in a spreadsheet before anything reaches TestRail (Gate 1). Use when a story reaches Ready for QA, when adding regression coverage to an existing feature, or when the user asks to plan or write test cases for a feature.
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

Read any existing `specs/cases/*.csv` for this area. If TestRail is configured, also call `testrail_status`
(its `warnings` must be empty; fix `.qa/config.json` first if not), then `testrail_get_sections` and
`testrail_get_cases` for the closest section. Note existing cases that
already cover parts of this feature; the new set adds to them, it doesn't repeat them. If the existing
section is itself bloated or repetitive, suggest `/qa-kit:review-cases` for it first.

## 3. Explore and write the plan

Make sure the app is reachable first: `BASE_URL`, or the local dev server from `app.devCommand` in
`.qa/config.json` (start it in a separate terminal so the agent doesn't wait on a cold compile). Load
`app.readyPath` once with `curl` until it answers, so the first page compile happens before the agent starts.

Check that the browser agents are guarded: `.mcp.json` runs `playwright-test` through
`.qa/scripts/mcp-guard.mjs` and the planner agent has the "When the browser gets stuck" block. If not, run
`node "${CLAUDE_PLUGIN_ROOT}/scripts/patch-agents.mjs"` (copy `mcp-guard.mjs` from the kit's templates first if
it's missing) and ask the user to restart Claude Code so the MCP server restarts behind the guard.

Use the **playwright-test-planner** agent, **one business-risk group per run** (three or four scenarios),
so a run that gets stuck loses little. Give it:

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
  option's text in the field and press Enter instead of retrying the click. Two attempts per step; anything
  still blocked goes under `## Not explored` with what was tried, and the agent moves on.

**Don't wait on a stuck agent.** Every browser action is limited to about 45 seconds by the guard, so the
agent gets an error and tries another way instead of hanging. If the planner runs in the background, start
the watchdog next to it as a background command:

```bash
node .qa/scripts/mcp-guard.mjs --watch --stale=120
```

It exits with a `STUCK:` line when a browser call has been open, or nothing has happened, for 2 minutes. When
it fires: stop the planner (TaskStop, or ask the user to press Esc), read the end of
`.qa-cache/mcp-guard.log` to see where it stopped, and ask the user (below). When the planner finishes first,
stop the watchdog.

**Ask instead of guessing.** After each run, collect the scenarios under "Not explored", plus the one a
stuck run was on, and ask the user with AskUserQuestion, one question per blocked scenario (up to four at a
time). Options:

- **Give a hint**: the user says how to get past the step (which control, which data); re-run just that
  scenario with the hint.
- **I'll explore it**: the user checks it by hand and tells you the outcome; write the scenario from that.
- **Skip for now**: list it under "Left out of this plan" with the reason.
- **Retry**: only if the cause looked temporary (app restarted, data fixed).

If setup failed ("app not reachable"), ask the user to start the app before anything else.

## 4. Write the cases CSV

The cases live in `specs/cases/<feature-slug>.csv`, one row per case (format: `specs/cases/README.md`).
Nothing goes to TestRail yet: the reviewer judges the whole set in a spreadsheet first.

```bash
node .qa/scripts/cases.mjs from-plan specs/<feature-slug>.md specs/cases/<feature-slug>.csv --prefix=<KEY>
```

`<KEY>` is a short feature prefix (`PO` for purchase orders). Then, per row, fill what the planner can't
know: `risks` (ranks from the business context), `type`, and `known_issue` for rows that look wrong in the
code (with the open question it depends on). Use
`node .qa/scripts/cases.mjs set <csv> <KEY> <column>=<value>` or edit the file. Leave `testrail_id` and
`decision` empty; set `suggestion` to `Keep`.

## 5. Prune to a strong set

Apply the playbook's "No junk" rules in the CSV before handing it over:

- merge per-field validation into one row with a `data` table, and per-role checks of one action into one row;
- turn fragments of one business chain into a journey row with a checkpoint per step;
- drop page-loads, button-exists and duplicate cases, and anything that can't realistically fail;
- keep a known-bug case in its own row so its failure doesn't hide the healthy checks;
- aim for 8-15 rows; every row beyond that must name a risk the others don't cover;
- priority from business impact (P1 money/stock/access/data loss in a common flow, P2 wrong but
  recoverable or rare, P3 cosmetic).

Merged and dropped candidates are simply not written (they were never pushed). Then:

```bash
node .qa/scripts/cases.mjs check specs/cases/<feature-slug>.csv   # no errors; read the risk coverage
node .qa/scripts/cases.mjs plan  specs/cases/<feature-slug>.csv   # regenerates the plan's scenarios
```

Keep the hand-written parts of `specs/<feature-slug>.md` (overview, key facts, known risks, what's left
out) above the generated block, and a short "Merged / dropped" list at the end.

## 6. Hand over for review (Gate 1, in the sheet)

Tell the user, briefly:

1. a **risk → case** table (from `check`'s coverage, with priorities);
2. risks **not** covered and why;
3. cases merged or dropped, one line each;
4. open questions, including anything in the implementation that looked wrong;
5. the next step: open `specs/cases/<feature-slug>.csv`, fill the `decision` column (`Keep`, `Rewrite`,
   `Drop`, `Merge into <key>`; fill-down `Keep` and change the exceptions), save as CSV, then run
   `/qa-kit:push-cases specs/cases/<feature-slug>.csv`. `/qa-kit:review-cases` can give a second opinion first.

Commit the CSV and the plan on a branch (`qa/cases-<feature-slug>`) and open a PR if the repo uses them, so
the review is visible. Don't push to TestRail from this skill.
