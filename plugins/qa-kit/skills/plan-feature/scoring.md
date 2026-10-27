# Independent case scoring

The brief for a reviewer that scores a cases CSV **without having seen how the cases were planned**. The
planner who wrote the cases tends to defend them; a fresh reader judges them the way the owner will.

## How to run it

From `plan-feature` step 5 (always) or `review-cases` (when the user asks for scores), start a subagent with
the Agent tool, `subagent_type: "general-purpose"`, and a prompt made of:

1. the text of the "Reviewer brief" section below, verbatim;
2. the paths it may read, and nothing else: the cases CSV, `.qa/business-context.md`, `.qa/glossary.md`;
3. the output path: `.qa-cache/scores-<feature-slug>.json`.

Don't add the planning conversation, the brief, the plan file or your own opinion of the cases. The point
is a reader who only knows the business and the cases.

When it finishes, apply the scores and check the result:

```bash
node .qa/scripts/cases.mjs apply-scores specs/cases/<feature-slug>.csv .qa-cache/scores-<feature-slug>.json
node .qa/scripts/cases.mjs check specs/cases/<feature-slug>.csv --tier=<tier>
```

`apply-scores` writes `score` on every row and a `suggestion` on rows that fail the rubric. It never fills
`decision`: the person still decides at Gate 1. If it reports errors (an unknown key, a bad number), nothing
was written; fix the JSON or re-run the reviewer.

Read the changed suggestions before handing over. Where you disagree, leave the reviewer's suggestion and add
your reason to `review_notes`; the person sees both.

## Reviewer brief

You are reviewing test cases for a business owner who is not technical. You have not seen how they were
written. Read `.qa/business-context.md` (what the business is, what must never go wrong, the areas and
their risk tiers) and `.qa/glossary.md`, then every row of the cases CSV whose `decision` isn't `Drop` or
`Merge into ...`. Each row is one case: `title`, `scenario` (Given/When/Then; older rows have
`preconditions`/`steps`/`expected`), `data`, `priority`, `level`, `risks`, `why_it_matters`.

Score every row on four questions:

| Field | Question | Values |
| --- | --- | --- |
| `impact` | If this broke in production, what does the owner lose? | 1 cosmetic or convenience; 2 wrong but recoverable (a support ticket, a manual fix); 3 money, data, access or legal exposure |
| `likelihood` | How plausible is this situation in real use? | 1 rare (needs an unusual sequence or input); 2 occasional; 3 common (every day, or what a rushed user does) |
| `unique` | Is it the only row that would catch this problem? | `true`, or `false` with `duplicate_of`: the key of the row that already catches it (the stronger or broader one) |
| `observable` | Could a person check every Then line by looking at the app? | `true`, or `false` when a Then is vague ("works", "correctly"), invisible (an internal record nobody sees) or not a result at all |

Judge from the business context, not from how the case is phrased. A case naming a "must never go wrong"
rule is impact 3 only if breaking this case would actually break that rule. Likelihood comes from how real
users behave (the context's "Real-world usage" and "Past incidents"); a past incident makes it at least 2.

Add a `reason` of at most 15 words to any row with impact × likelihood under 3, `unique: false` or
`observable: false`, written for the owner ("only the label wording changes", "RF-02 already refuses the same
refund").

Write only this JSON array to the output path, one object per row you scored:

```json
[
  { "key": "RF-01", "impact": 3, "likelihood": 2, "unique": true, "observable": true },
  { "key": "RF-04", "impact": 3, "likelihood": 2, "unique": false, "duplicate_of": "RF-01", "observable": true, "reason": "RF-01 already refuses a refund over the amount paid" }
]
```

Don't edit the CSV or any other file. Reply with one line: how many rows you scored and how many fail the
rubric.

## What the scores do

| Result | Suggestion written |
| --- | --- |
| `unique: false` | `Merge into <duplicate_of>: <reason>` |
| impact × likelihood under 3 | `Drop: score <i>x<l> under 3; <reason>` |
| `observable: false` | `Rewrite: not observable; <reason>` |
| P1 with impact under 3 | `Rewrite: P1 needs impact 3, ...` (make it P2, or show the bigger loss) |
| otherwise | the suggestion is left as it was (`Keep` if empty) |

The first rule that applies wins. `check --tier` then warns if the live set is still over the feature's
budget and names the lowest-scoring rows, so the person knows what to cut first.
