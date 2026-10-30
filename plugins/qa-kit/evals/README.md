# Evals for the QA Kit skills

Prompt changes to the skills used to ship untested. These cases run `discover` and `plan-feature`
unattended with `claude plugin eval` and grade what they write, so a change that makes the cases worse
shows up in a score.

## What's here

| Path | What it is |
| --- | --- |
| `sample-app/` | Kolachi Supplies, a small wholesale ordering app (Node, no dependencies) with six known bugs |
| `KNOWN-BUGS.md` | The bugs, by feature. Not copied into runs; the graders name them |
| `owner-answers.md` | The owner's answers to discover's questions, so discover runs without a person |
| `context/` | The confirmed business context and glossary the plan cases start from |
| `briefs/` | Three tickets as briefs (refunds, coupons, staff-orders), each with the owner's `## Decisions` |
| `scaffold.sh` | Builds a run's folder: the sample app, the kit installed by `install-templates.mjs`, committed |
| `hard-graders.mjs` | CI gate: fails on any failed deterministic grader, whatever the score |
| `cases/` | One folder per case: `case.yaml` (prompt and graders) and `setup.sh` (calls `scaffold.sh`) |

## The cases

- **discover**: no business context yet. Graders check that no template placeholder is left, facts carry
  `(owner, 2026-10-20)`, the glossary is filled, `a11y`, `areas` and an Android device are set in
  `.qa/config.json`, and (judged) the five disasters are rules in the owner's order with nothing invented.
- **plan-refunds**, **plan-coupons**, **plan-staff-orders**: the confirmed context and one brief. Graders
  check that `specs/cases/<feature>.csv` exists, `cases.mjs check` ran and the last time it ran it reported
  `0 error(s)` (the case's prompt says to finish with `check` and not edit the CSV after it), and
  (judged, on the CSV) that live cases are within the tier's budget, every owner risk the feature touches
  has a case, both known bugs have their own case expecting the right behaviour, no two cases catch the
  same bug, and a non-technical owner can read every scenario.

Every case also has `no-peeking`: the run fails if its trace mentions `qa-kit/evals/`, since the suite
sits inside the plugin folder and a run could otherwise read the known bugs or the graders.

`claude plugin eval` has no script graders, so these checks are regexes over the run's trace and judged
rubrics over the CSV, not `cases.mjs` run on the final file. The judged ones are noisy on long files; the
rubrics name what to ignore and give concrete PASS and FAIL conditions.

Runs are unattended: each case's system prompt says no person is present (answers come from the brief's
Decisions or `owner-answers.md`) and no browser or running app is available, so `plan-feature` writes the
plan from the code, the brief and the context instead of exploring with the planner agent. The browser
exploration itself isn't covered here. The TestRail server isn't started (no mock; the sample's tracker is
`none`).

## Run

From `plugins/qa-kit`:

```bash
claude plugin eval . --scaffold --trust-plugin --allow-tools Bash Write Edit --ablation none --runs 1 --max-cost-usd 15
```

One case: add `--case plan-refunds` (a `[...]` class in the glob matches nothing, and no match still exits 0). `--keep-temp` keeps each run's folder to inspect what it wrote. The
report lands in `evals/results/<timestamp>/` (gitignored). `--scaffold` runs `setup.sh`, which copies the
sample app and runs the installer as you; these are the kit's own files.

CI (`.github/workflows/kit-evals.yml` at the repo root) runs the suite on PRs that change `skills/`,
`templates/.qa/scripts/` or `evals/`, with the `ANTHROPIC_API_KEY` secret, a 0.8 score threshold and a
cost cap; then `hard-graders.mjs` fails the job if any deterministic grader failed in any run. Pull requests
from forks get no secrets, so the job doesn't run there (a notice says so); run it with workflow_dispatch.
Neither workflow has run on GitHub yet. `kit-tests.yml` runs the script tests on every plugin change.

Cost and time, one run each with Sonnet (2026-10-29): discover $0.24 in about a minute, each plan case
about $0.45 to $0.60 in 3 to 4 minutes, so the suite is about $2 and 15 minutes. All four cases passed
every grader. A planted bad CSV (a duplicate row, "clicks the Refund button") failed both rubric graders.

## Changing the suite

- A new known bug: add it to `sample-app/`, list it in `KNOWN-BUGS.md`, and name it in that feature's
  `known-bugs-found` grader.
- A new ticket: a brief in `briefs/` with its `## Decisions`, a `cases/plan-<feature>/` copied from an
  existing one with the feature, tier, budget, risks and bugs changed.
- Keep `context/business-context.md` in step with `owner-answers.md`: the plan cases assume discover would
  write it.
