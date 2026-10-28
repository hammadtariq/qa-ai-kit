---
name: upkeep
description: Weekly suite health check - approved cases without automation (TestRail or the cases CSVs), tests pointing at missing cases, duplicate ids, flaky, quarantined and fixme tests - and a proposed next batch of work. Use weekly or when the user asks about coverage gaps.
disable-model-invocation: true
---

# Weekly upkeep

1. Collect what the code has (no tokens spent on reading test files):

   ```bash
   node .qa/scripts/collect-test-ids.mjs > reports/test-ids.json
   ```

   It lists every case id found in `tr(...)` annotations (TestRail ids, or CSV keys with no tracker) with
   file:line and tags, tests with no id, duplicate ids, tests tagged `@quarantine` or marked `fixme`, and the
   `tracker`.

2. Collect the cases: with TestRail, `testrail_get_cases` for the whole project (compact). With no tracker,
   the rows of `specs/cases/*.csv`: `Keep` rows that aren't `level` = `unit` are the approved cases, matched to
   tests by `key`; undecided and `Rewrite` rows are the ones waiting for Gate 1.

3. Compare and write `reports/upkeep-<yyyy-mm-dd>.md` with these sections, each a table:
   - **Not automated yet**: approved cases with no test, sorted by priority. These are the next batch.
   - **Orphans**: case ids in code that no longer exist in TestRail (or keys in no CSV, or on a dropped row).
   - **Missing ids**: tests with no `tr()` annotation (nothing links their results to a case).
   - **Duplicates**: one case id used by more than one test.
   - **Quarantined and fixme**: each with its open issue, and how long it has been there.
   - **Drafts waiting for Gate 1**: count by section and the oldest date.
   - **Business risks without a test**: each "must never go wrong" rule and each past incident in
     `.qa/business-context.md` that no automated case protects yet.

4. Propose the next batch: up to 10 P1/P2 cases to automate this week, uncovered business risks first, grouped by feature, so the team
   can run `/qa-kit:generate-tests` per feature. Flag quarantined tests older than 14 days for deletion or a fix.

Keep the report under one screen per section. Tell the user where it is and the three most important findings.
