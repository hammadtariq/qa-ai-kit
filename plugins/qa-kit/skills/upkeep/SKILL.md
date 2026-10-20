---
name: upkeep
description: Weekly suite health check - TestRail cases without automation, tests pointing at missing cases, duplicate ids, flaky, quarantined and fixme tests - and a proposed next batch of work. Use weekly or when the user asks about coverage gaps.
disable-model-invocation: true
---

# Weekly upkeep

1. Collect what the code has (no tokens spent on reading test files):

   ```bash
   node .qa/scripts/collect-test-ids.mjs > reports/test-ids.json
   ```

   It lists every case id found in `tr('C…')` annotations with file:line and tags, tests with no id,
   duplicate ids, and tests tagged `@quarantine` or marked `fixme`.

2. Collect what TestRail has: `testrail_get_cases` for the whole project (compact).

3. Compare and write `reports/upkeep-<yyyy-mm-dd>.md` with these sections, each a table:
   - **Not automated yet**: approved cases with no test, sorted by priority. These are the next batch.
   - **Orphans**: case ids in code that no longer exist in TestRail.
   - **Missing ids**: tests with no `tr()` annotation (their results never reach TestRail).
   - **Duplicates**: one case id used by more than one test.
   - **Quarantined and fixme**: each with its open issue, and how long it has been there.
   - **Drafts waiting for Gate 1**: count by section and the oldest date.

4. Propose the next batch: up to 10 P1/P2 cases to automate this week, grouped by feature, so the team
   can run `/qa-kit:generate-tests` per feature. Flag quarantined tests older than 14 days for deletion or a fix.

Keep the report under one screen per section. Tell the user where it is and the three most important findings.
