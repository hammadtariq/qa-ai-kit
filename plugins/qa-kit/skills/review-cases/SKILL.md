---
name: review-cases
description: Review an existing TestRail section as the business owner would - find repetitive, fragmented or low-value cases, propose keep / merge / rewrite / retire with reasons and spot uncovered risks, then apply only what the user confirms (merged cases go back to AI draft, retired ones are moved, never deleted). Use when a section feels too big, before or after Gate 1, when inheriting a suite, or when the user asks to clean up, dedupe or consolidate test cases.
argument-hint: "<TestRail section name or id, or a plan file like specs/purchase-orders.md>"
disable-model-invocation: true
---

# Review a section of test cases

Section: `$ARGUMENTS`

The goal is **fewer, stronger cases**: every case protects something the business owner would lose,
and no two cases protect the same thing. Review one section (one feature) per session.

This skill is **read-only until the user confirms**. It never approves cases (Gate 1 is a person's
call), never deletes anything, and never edits specs.

## 0. Load the yardsticks

- `.qa/business-context.md`: what must never go wrong, the rules, real usage, known gaps. If it is
  missing, stop and suggest `/qa-kit:setup-project` (or fill it as `plan-feature` step 0 does).
- The playbook `${CLAUDE_PLUGIN_ROOT}/skills/plan-feature/test-design.md`, especially "No junk" and
  "Shape of a good case". It is the standard every case is judged against.
- The QA conventions in `CLAUDE.md` (test folder, roles, UI notes).

## 1. Read the cases

- `testrail_status` (its `warnings` must be empty), then `testrail_get_sections` to find the section by
  name or id. A plan file argument: read it and use the section and case ids it lists.
- `testrail_get_cases` with `section_id` and `details: true`: every case with priority, review state,
  automation flag, preconditions and steps, in one call. If the section has child sections, call it once per child too.
- Find which cases are already automated: `grep -rn "tr('C" <testDir>` (`testDir` from `.qa/config.json`)
  and any plan in `specs/` that lists the ids. Merging an automated case means changing its spec later.
- Read the feature's implementation (API handlers, validation, permissions, side effects) enough to check
  expected results against the business rules, as `plan-feature` step 1 does.

## 2. Judge every case

For each case decide one of:

| Verdict | When |
| --- | --- |
| **Keep** | It protects a business risk no other case covers, its expected results are concrete, and it's shaped well |
| **Merge into Cn** | Same behaviour as another case with a different value of no business significance; one step of a chain another case walks through; per-field or per-role variants of one rule (they become rows of a data table or checkpoints of a journey) |
| **Rewrite** | The risk is real but the case is vague ("works correctly"), asserts current behaviour that looks wrong, misses the downstream check (stock, ledger, report), or has the wrong priority |
| **Retire** | Proves only that a page loads or a button exists, can't realistically fail, protects nothing the owner would lose, or has a non-deterministic expected result E2E can't produce reliably (move it to unit or integration tests) |

Rules for merging:

- Pick the **survivor** in this order: the case already automated, then the highest priority, then the
  most complete steps, then the lowest id. The survivor keeps its id so TestRail history stays.
- Keep a **known-bug case separate** from healthy rows (a failing row would mark the whole merged test
  failed or force it to `test.fixme()`). Note that it folds in once the bug is fixed.
- Don't merge cases that need **different setups** or whose combined journey would let one failure hide
  the others' results.
- Merged steps must keep every distinct check from the cases they absorb. List what each absorbed case
  contributes ("C13 → step 3: stock row created for a new item").

Then look for **gaps**: rank the business context's "must never go wrong" list against the result and
name any risk with no case. Gaps are proposals for `/qa-kit:plan-feature`, not new cases here.

Aim for the playbook's 8–15 cases per feature. More is fine for money-heavy features if each extra case
names a risk the others don't cover.

## 3. Report

Write `reports/case-review-<section-slug>-<yyyy-mm-dd>.md` (gitignored, a working copy; the plan in
`specs/` is what gets committed) and summarise it to the user:

1. **Before → after**: case count, P1 count, automated count.
2. **Resulting cases**: one row each: survivor id, title in the owner's words, priority, cases merged in,
   why it matters.
3. **Rewrites**: id, what's wrong, the fix.
4. **Retired**: id, reason, one line each.
5. **Gaps**: uncovered risks and their rank in the business context.
6. **Automation impact**: specs that reference merged or retired ids and will need changing.
7. **Open questions**: expected results that depend on an owner decision or look wrong in the code.

Ask the user which parts to apply. Default to nothing.

## 4. Apply (only what the user confirmed)

1. Make sure the plan reflects the result: update `specs/<feature>.md` (or write it if the section had no
   plan) with the surviving cases and a "Retired cases" table mapping each retired id to its survivor.
   On a repo with a PR workflow, do this on a branch and open a PR.
2. For each survivor that changes, call `testrail_update_case` with the new `title`, `preconditions`
   (ending with a `Why it matters:` line) and `steps`. Data tables go inside the step text. The server sets
   rewritten cases back to **AI draft**, so they return to Gate 1. Say so in the summary.
3. Retire without deleting: find or create a section named `Retired` (`testrail_add_section`, at the top
   level of the suite), then `testrail_move_cases` with all retired and merged ids in one call. Moving
   keeps ids, history and past results. If the move fails (TestRail older than 6.5.2), give the user
   the id list to bulk-move in TestRail: select the cases, then Move.
4. Report what changed, the TestRail link to the section, and the Gate 1 count: only the rewritten
   survivors need re-approval.

Specs referencing retired ids are not changed here. List them and suggest `/qa-kit:generate-tests` for
the survivors once they are approved again (Gate 2 then reviews the spec PR).
