---
name: triage
description: Classify Playwright failures as environment, test drift, product bug or unclear; heal drift, draft bugs for Gate 4, escalate the rest to Gate 3, and quarantine repeat-flaky tests. Use in CI after a failed run, or locally when the user asks why tests failed.
argument-hint: "nightly | pr <number> | [path to results.json]"
disable-model-invocation: true
---

# Triage test failures

Mode: `$ARGUMENTS` (`nightly`, `pr <number>`, or a report path; default `reports/results.json`).

Spend tokens only where judgment is needed: read the compact failure list first, open
`error-context.md` files next, and open a trace only when those two don't explain the failure.

## 1. Get the failures

```bash
node .qa/scripts/failures.mjs reports/results.json > reports/failures.json
cat reports/failures.json
```

Each entry has the case id, file:line, project, error (trimmed), retries, and paths to
`error-context.md` (the page's accessibility snapshot at the failure) and the trace.
Also read `reports/flaky.json` if it exists (quarantine candidates from the nightly run).

If there are more than `triage.maxFailures` failures in `.qa/config.json` (default 15), group first and
look at one representative per group.

## 2. Group and classify

Group failures that share a root cause (same error text, same step, same page). Then put each group in one bucket:

| Bucket | Signs | Action |
| --- | --- | --- |
| **Environment** | Many unrelated tests fail at navigation or login; 5xx, DNS or timeout on `goto`; setup project failed | One issue labelled `qa:env`, no healing. Stop processing that group |
| **Test drift** | Element renamed, moved or re-labelled; the snapshot shows the intended control with a new name or role; behaviour is otherwise correct | Heal (step 3) |
| **Product bug** | The app does the wrong thing: wrong total, missing record, error on a valid action, a 4xx/5xx from an API the test calls correctly | Draft a bug (step 4) |
| **Unclear** | Can't tell intended change from bug, or the fix would mean changing an expected value | Escalate (step 5) |

When unsure between drift and bug, choose **Unclear**. A wrong "drift" call hides a real bug.

## 3. Heal test drift

- Create a branch `qa/heal-<yyyy-mm-dd>` (nightly) and use the **playwright-test-healer** agent on the drift
  tests only, one group at a time.
- The healer may change locators, waits and navigation only. In CI a hook denies any change to an
  assertion matcher or expected value; if that happens, move the test to Unclear and do not retry the edit.
- Confirm: `<test command> <files> --repeat-each=3` passes (`npx playwright test`, or the standalone
  command in `CLAUDE.md` → Commands).
- Open one PR: `gh pr create --label qa:heal` listing each test, what changed and why, with before/after locators.
- In `pr` mode, don't push to the developer's branch: post the suggested change as a PR comment instead.

## 4. Draft product bugs (Gate 4)

One issue per bug, `gh issue create --label qa:gate-4,bug`:

- Title: what's wrong, in user terms ("Checkout total ignores the 10% coupon").
- Severity from business impact, using `.qa/business-context.md`: **critical** if it breaks a "must never
  go wrong" rule (money, stock, access, data), **major** if a common flow is wrong but recoverable,
  **minor** otherwise. Put it first in the body with one line on what the owner loses.
- Body: steps to reproduce (from the test), expected vs actual, case id, environment (`BASE_URL`, browser),
  CI run link (`$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`), and the trace artifact name.
- Add "Drafted by QA Kit. A QA engineer must reproduce this before it goes to the client."

## 5. Escalate unclear failures (Gate 3)

`gh issue create --label qa:gate-3` with the failure, what you think changed, the assertion that would
have to change, and the evidence. Leave the test untouched.

## 6. Quarantine repeat-flaky tests

For each entry in `reports/flaky.json` → `quarantineCandidates` (3+ flaky runs in 7 days): add
`'@quarantine'` to that test's `tag` list (keep existing tags) in the heal PR, and open an issue labelled
`qa:quarantine` with the flaky history and your best guess at the cause (shared data, timing, animation,
test order).

## 7. Write the summary

Write `reports/triage.md` (the digest and the job summary read it):

```markdown
## Triage <date> - <n> failures in <g> groups
| Bucket | Tests | Action | Link |
| --- | --- | --- | --- |
```

In CI also append it to `$GITHUB_STEP_SUMMARY`. In `pr` mode, post it as one PR comment
(`gh pr comment <n> --body-file reports/triage.md`), updating your earlier comment if there is one.
