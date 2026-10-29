---
name: review-cases
description: Review a feature's test cases (a cases CSV, or an existing TestRail section) as the business owner would - find repetitive, fragmented or low-value cases, propose keep / merge / rewrite / drop with reasons in the CSV's suggestion column and spot uncovered risks. The reviewer decides in the sheet; /qa-kit:push-cases updates TestRail. Use when a section feels too big, before or after Gate 1, when inheriting a suite, or when the user asks to clean up, dedupe or consolidate test cases.
argument-hint: "<specs/cases/<feature>.csv, a TestRail section name or id, or a plan file>"
disable-model-invocation: true
---

# Review a section of test cases

Section: `$ARGUMENTS`

The goal is **fewer, stronger cases**: every case protects something the business owner would lose,
and no two cases protect the same thing. Review one section (one feature) per session.

Changes happen in the **cases CSV** (`specs/cases/<feature>.csv`, format in `specs/cases/README.md`), not in
TestRail: this skill writes its verdicts to the `suggestion` column, the reviewer fills `decision`, and
`/qa-kit:push-cases` copies the result to TestRail. It never fills `decision`, never approves cases,
never deletes anything and never edits specs. Rewriting rows waits for the user's yes.

Run `node .qa/scripts/cases.mjs tracker` once. **With `none`, skip every TestRail step and count below**: the
CSV is the only record, there is no `testrail_id`, and after the reviewer's decisions the CSV is final.

## 0. Load the yardsticks

- `.qa/business-context.md`: what must never go wrong, the rules, real usage, known gaps. If it is
  missing, or a "must never go wrong" item is tagged `(assumed)`, run `/qa-kit:discover` first (or its
  short form for that area). Without the owner, review against what's there, and say which verdicts depend
  on an `(assumed)` fact.
- `.qa/glossary.md`: the words cases should use.
- The playbook `${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/test-design.md`, especially "No junk", "Writing
  the case" and the good / bad pairs. It is the standard every case is judged against.
- The feature's brief, if there is one: its `## Decisions` are the owner's answers; don't ask them again.
- The QA conventions in `CLAUDE.md` (test folder, roles, UI notes).

## 1. Read the cases

- **CSV** (the argument, or `specs/cases/<feature>.csv` for the feature named): it is the source.
  `node .qa/scripts/cases.mjs check <csv>` gives the counts and the risk coverage. With TestRail,
  also read the section (below) to spot drift: cases in TestRail that no row mentions, or
  text that differs.
- **TestRail section, no CSV yet** (TestRail only): `testrail_status` (its `warnings` must be empty), then
  `testrail_get_sections` to find the section, and `testrail_get_cases` with `section_id` and
  `details: true` (once per child section too). Write those cases to `specs/cases/<feature>.csv` first, one
  row each with `testrail_id` filled and `decision` empty, so the review happens in the sheet: the "Why it
  matters" line from the preconditions into `why_it_matters`, and the case as a `scenario` (the
  preconditions as Given lines, each step as When lines, its expected result as Then lines). Cases pushed
  by the kit since 0.6.0 already read Given/When/Then and copy over as they are.
- **Old CSV with steps/expected** (before 0.6.0): it still works. Offer
  `node .qa/scripts/cases.mjs migrate <csv>`, which converts every row to a scenario without touching ids or
  decisions and marks each `Rewrite` for wording. Only with the user's yes.
- **Plan file**: if it has a generated cases block, use its CSV; otherwise convert it with
  `node .qa/scripts/cases.mjs from-plan <plan> <csv>`.
- Find which cases are already automated: `grep -rn "tr('C" <testDir>` (`testDir` from `.qa/config.json`)
  and any plan in `specs/` that lists the ids. Merging an automated case means changing its spec later.
- Read the feature's implementation (API handlers, validation, permissions, side effects) enough to check
  expected results against the business rules, as `plan-feature` step 1 does.

## 2. Judge every case

For each case decide one of:

| Verdict | When |
| --- | --- |
| **Keep** | It protects a business risk no other case covers, its expected results are concrete, and it's shaped well |
| **Merge into KEY** | Same behaviour as another case with a different value of no business significance; one step of a chain another case walks through; per-field or per-role variants of one rule (they become rows of a data table or checkpoints of a journey) |
| **Rewrite** | The risk is real but the case is vague ("works correctly"), asserts current behaviour that looks wrong, misses the downstream check (stock, ledger, report), has the wrong priority, uses technical wording (clicks, fields, endpoints, status codes) or words the glossary avoids, or is too long (more than 7 lines, or more than 4 When/Then pairs: split it) |
| **Drop** | Proves only that a page loads or a button exists, can't realistically fail, protects nothing the owner would lose, or has a non-deterministic expected result E2E can't produce reliably (move it to unit or integration tests) |

Read the case as the owner would: could they tell in ten seconds what it protects and whether it passed?
`node .qa/scripts/cases.mjs check <csv>` lists the wording problems it can find (technical words, vague
Thens, length, glossary); use its errors and warnings as evidence for `Rewrite`, and judge what it can't
(whether the Given is the real starting point, whether the Then is the check the owner cares about).

Rules for merging:

- Pick the **survivor** in this order: the case already automated, then (with TestRail) the one already in
  TestRail, then the highest priority, then the most complete steps, then the lowest key. The survivor keeps
  its key (and its `testrail_id`, so TestRail history stays).
- Keep a **known-bug case separate** from healthy rows (a failing row would mark the whole merged test
  failed or force it to `test.fixme()`). Note that it folds in once the bug is fixed.
- Don't merge cases that need **different setups** or whose combined journey would let one failure hide
  the others' results.
- Merged steps must keep every distinct check from the cases they absorb. List what each absorbed case
  contributes ("C13 → step 3: stock row created for a new item").

Then look for **gaps**: rank the business context's "must never go wrong" list against the result and
name any risk with no case. Gaps are proposals for `/qa-kit:plan-feature`, not new cases here.

Also check each row's `level`: a long validation table belongs at `api` (keep at most one `ui` row for the
message), a pure calculation at `unit`. Suggest the change in `review_notes` and as a `Rewrite`.

Aim for the budget of the feature's risk tier (`check --tier=<tier>`, from "Areas and risk tiers" in the
business context; defaults low 6, medium 12, high 20 `ui` + `api` rows). More is fine only if each extra case
names a risk the others don't cover.

**Independent scores (when the user asks, or when the set is over budget):** run the reviewer in
`${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/scoring.md` before your own judgment, apply its scores with
`cases.mjs apply-scores`, and treat its suggestions as a second opinion: where you disagree, say why in
`review_notes` rather than overwriting it.

## 3. Report

Write each verdict to the row's `suggestion` column with a short reason (`Merge into PO-04: same form
guard, different trigger`, `Drop: only proves the page loads`). Don't touch `decision`; that's the
reviewer's. Then summarise for the user (and in `reports/case-review-<feature>-<yyyy-mm-dd>.md`, gitignored):

1. **Before → after**: case count, P1 count, automated count, in TestRail count (TestRail only), and the count against the
   tier's budget.
2. **Resulting cases**: one row each: survivor key and id, title in the owner's words, priority, cases
   merged in, why it matters.
3. **Rewrites**: id, what's wrong, the fix.
4. **Dropped**: key, reason, one line each.
5. **Gaps**: uncovered risks and their rank in the business context.
6. **Automation impact**: specs that reference merged or dropped ids and will need changing.
7. **Open questions**: expected results that depend on an owner decision or look wrong in the code.

Ask the user which merges and rewrites to write into the CSV. Default to nothing.

## 4. Apply (only what the user confirmed)

1. In the CSV: for each confirmed merge, add the absorbed rows' distinct checks to the survivor (Then lines
   or When/Then pairs in its `scenario`, `data` rows); for each confirmed rewrite, rewrite the row's
   `title` and `scenario` in business words (technical details move to `notes`). Leave the absorbed and dropped rows in
   the file with their suggestion, so the reviewer sees what goes and `push-cases` can retire the ones that
   are in TestRail. Rows that were never pushed (every row, with no tracker) can be deleted once the reviewer agrees.
2. `node .qa/scripts/cases.mjs check <csv>`, then `node .qa/scripts/cases.mjs plan <csv>` to regenerate the
   plan's scenarios. On a repo with a PR workflow, commit on a branch and open a PR.
3. Tell the user the next step: fill the `decision` column (accept or overrule each suggestion) and save.
   With TestRail, then run `/qa-kit:push-cases <csv>`; rewritten cases go back to AI draft in TestRail, so
   only those need approving again.

Specs referencing dropped or merged ids are not changed here. List them and suggest
`/qa-kit:generate-tests` for the survivors once they are approved (Gate 2 then reviews the spec PR).
