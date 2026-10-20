---
name: digest
description: Show what is waiting for the QA team right now - latest run results, open gate items and flaky or quarantined tests. Use when the user asks what needs review, for a QA status, or for the morning digest.
argument-hint: "[--post to send it to Slack]"
---

# QA digest

The nightly workflow already posts this to Slack without using Claude (`.qa/scripts/summary.mjs`).
Use this skill for an on-demand view, or when the user wants it across the current repo's gates.

1. Latest automated run: if `reports/results.json` exists locally, run
   `node .qa/scripts/summary.mjs --print`. Otherwise call `testrail_get_runs` with `limit: 3` and
   `testrail_get_run_summary` for the newest one.
2. Gate queues, one `gh` call each (`--json number,title,url,createdAt`):
   - Gate 2: `gh pr list --label qa:gate-2`
   - Healer PRs: `gh pr list --label qa:heal`
   - Gate 3: `gh issue list --label qa:gate-3`
   - Gate 4: `gh issue list --label qa:gate-4`
   - Quarantined: `gh issue list --label qa:quarantine`
3. Gate 1 (cases awaiting approval): `testrail_get_cases` and count `review: "ai-draft"` by section.

Reply with one short table: queue, count, oldest item age, link. Put anything older than 2 working days first.
If `$ARGUMENTS` contains `--post`, run `node .qa/scripts/summary.mjs` instead, which posts to `SLACK_WEBHOOK_URL`.
