---
name: client-report
description: Write the monthly QA report for a client from TestRail data - runs, pass-rate trend, coverage and bugs caught before release. Use when the user asks for a client QA report, monthly QA summary, or proof of QA value for a retainer.
argument-hint: "[YYYY-MM, defaults to last month]"
disable-model-invocation: true
---

# Monthly client QA report

Month: `$ARGUMENTS` (default: the previous calendar month).

1. Data, all from tools rather than estimates:
   - `testrail_get_runs` with `created_after` / `created_before` for the month (raise `limit` to 100).
   - `testrail_get_cases` for coverage: total cases, cases automated, by priority.
   - Bugs caught: `gh issue list --label bug --state all --search "created:<month range>" --json number,title,state,labels,createdAt,closedAt`
     and keep the ones that went through `qa:gate-4`.
2. Compute with a short script, not by hand: runs per week, average and trend of pass rate, automated
   coverage now vs the start of the month, bugs found by severity, median time from found to fixed.
3. Write `reports/client-report-<YYYY-MM>.md` in plain language for a non-technical client:
   - a one-paragraph summary (the headline number first)
   - a small table of the figures above
   - the 3-5 most important bugs caught before they reached users, one line each
   - what QA will focus on next month
   Leave out internal details: tokens, healer PRs, gate names, flaky counts.
4. Tell the user where the file is. Offer to turn it into a PDF or a Docs page they can send.
