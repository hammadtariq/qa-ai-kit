# Business-first test design

The QA Kit's playbook for choosing test cases. `plan-feature` and `generate-tests` follow it; the QA lead
reviews against it at Gate 1. One rule sits above the rest: **a test case exists to protect something
the business owner would lose if it broke.** If you can't say what that is, the case doesn't belong.

## 1. Think like the owner of this kind of business

Before designing cases, read `.qa/business-context.md` (create it from the template if it's missing).
Then answer, for the feature in front of you, as the owner would:

- **What does this feature move?** Money (prices, totals, balances, refunds), stock, commitments to a
  customer (orders, quotes, delivery), access (who can see or change what), or records someone relies on
  later (ledgers, audit history, reports, tax documents).
- **What would hurt?** Lost or wrong money, phantom or missing stock, a customer billed twice, a supplier
  under-paid, a staff member doing something only the owner should, another tenant's data showing up, a
  report the accountant can't trust, a dispute you can't settle because the history is wrong.
- **What do real users do on a bad day?** Rush, double-click Save, use the back button, edit something
  already approved, enter 0 or a negative number, paste a value with commas, backdate an entry, work in two
  tabs, lose connection mid-save, come back a week later to fix a mistake.

Use what the niche knows. An inventory owner cares that stock on hand matches the warehouse and that the
supplier ledger balances; a clinic cares about double-booked slots and patient privacy; a SaaS owner cares
about plan limits and billing. Write cases about *those* things, in *their* words.

## 2. Acceptance criteria = required business behaviour, verified against the implementation

- The **business rule is the oracle**, not the code. "An approved purchase increases stock by the bales
  received" is a rule; "the approve handler calls increment()" is an implementation detail.
- **Read the implementation anyway** (API handlers, validation schemas, permission maps, state
  transitions, side effects such as ledger entries or emails) to find where it can disagree with the rule:
  a check done only in the UI, a status that isn't guarded, a side effect that isn't reversed, a rounding
  step, a missing tenant filter. Every such gap becomes a case, and if it already looks wrong, an
  **Open question** for the QA lead (never an "expected" result).
- Expected results are **concrete**: amounts, quantities, statuses, who sees what. "Total is Rs 12,500
  and the supplier balance rises from 40,000 to 52,500", not "total is correct".

## 3. Cover the dirty paths that matter

Pick from this catalogue the items that are realistic for the feature. Each one needs a business reason.

| Kind | Examples |
| --- | --- |
| Boundary and bad input | 0, negative, decimals where only whole units make sense, very large values, thousands separators, empty optional fields, max length, leading/trailing spaces, duplicates of a value that should be unique (invoice number) |
| State abuse | Act twice (approve, pay, refund), act out of order (pay before approve), edit or cancel after the record is final, re-open a closed record, delete something others depend on |
| Permission abuse | A lower role doing a higher role's action, both in the UI (hidden button) and directly through the API; a user from another organization guessing an id |
| Integrity across features | After a sequence (create → approve → edit → re-approve → cancel), do stock, balances, totals and reports still agree? Is the history/audit trail right? |
| Concurrency and repeats | Double-submit, two tabs editing the same record, two users approving at once, refresh mid-flow |
| Time and money | Backdated and future dates, period boundaries (month end), currency and rounding, partial payments, overpayment, refunds larger than the original |
| Recovery | Validation error then fix, failed save then retry, network drop mid-save: no half-written records, no duplicates |
| Visibility of consequences | The downstream screen the owner checks: dashboard totals, ledger, stock report, invoice/export |

Skip anything the platform already guarantees and that the business doesn't care about (a text box
accepting text, a page rendering, framework-level routing).

## 4. No junk: fewer, stronger cases

Before handing cases to TestRail, prune:

- **One case per business outcome, not per field.** Validation of six fields is one case with a table of
  inputs and expected messages, not six cases. Permission checks for one action across roles is one case.
- **Journeys over fragments.** When the risk is in the chain (create → approve → stock → ledger), write one
  journey case with a checkpoint after each step. Split only when steps need different setups, or when a
  single failure would hide the others.
- **Drop** cases that only prove a page loads or a button exists, that restate another case with a
  different value of no business significance, that can't realistically fail, or that existing cases
  already cover.
- **Merge** cases whose steps are the same and only the expected value differs; use a data table.
- **Aim for 8–15 cases per feature.** More is fine for money-heavy features, but every extra case must name
  a risk the others don't cover.

## 5. Shape of a good case

- **Title:** the business behaviour, in the owner's words. "Approving a purchase adds the received bales to
  stock and charges the supplier ledger", not "Test approve button".
- **Preconditions:** data and role, plus one line **"Why it matters:"** naming the business risk.
- **Steps** with **expected results that a person can check**, including the downstream screens.
- **Data table** when one behaviour is checked with several inputs.
- **Priority** from business impact × likelihood: P1 = money, stock, access or data loss in a common
  flow; P2 = wrong but recoverable, or rare; P3 = cosmetic or convenience.
- **Type:** Functional for behaviour, Security for permission/tenant cases, Regression for journeys
  guarding existing behaviour.

## 6. Review before handing over

Re-read the full set as the business owner would, and answer in the Gate 1 summary:

1. Which business risks are covered, by which case? (A short risk → case table.)
2. Which risks are not covered, and why (out of scope, needs data we don't have, open question)?
3. Which cases were merged or dropped, in one line each?
4. What in the implementation looked wrong or unguarded (the open questions)?
