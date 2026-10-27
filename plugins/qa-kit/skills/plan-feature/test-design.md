# Business-first test design

The QA Kit's playbook for choosing and writing test cases. `plan-feature`, `review-cases` and
`generate-tests` follow it; the QA lead reviews against it at Gate 1. One rule sits above the rest: **a
test case exists to protect something the business owner would lose if it broke.** If you can't say what
that is, the case doesn't belong.

## 1. Think like the owner of this kind of business

Before designing cases, read `.qa/business-context.md` and `.qa/glossary.md`. If the context is missing,
or a "must never go wrong" item is tagged `(assumed)`, run `/qa-kit:discover` first. Only facts tagged
`(owner, ...)` can justify a P1.

Then read the risk packs named under "Business type" in the context (`risk-packs/<type>.md`). They list
the usual disasters, the dirty paths users really hit and the downstream screens owners check for that
kind of business. They are prompts for your thinking, not cases: use an item only when this feature can
cause it.

Answer, for the feature in front of you, as the owner would:

- **What does this feature move?** Money (prices, totals, balances, refunds), stock or capacity (seats,
  slots, units), commitments to a customer (orders, bookings, deliveries), access (who can see or change
  what), or records someone relies on later (ledgers, audit history, reports, tax documents).
- **What would hurt?** Lost or wrong money, a customer charged twice, an overbooked slot, a seller paid
  too little, a staff member doing what only a manager should, another customer's data showing up, a
  report the accountant can't trust, a dispute nobody can settle because the history is wrong.
- **What do real users do on a bad day?** Rush, submit twice, go back and resubmit, edit something already
  approved, enter 0 or a negative number, paste a value with commas, backdate an entry, work in two tabs,
  lose connection mid-save, come back a week later to fix a mistake.

Write cases about *those* things, in the business's words (the glossary).

## 2. Acceptance criteria = required business behaviour, verified against the implementation

- The **business rule is the oracle**, not the code. "A refund never exceeds what the customer paid" is a
  rule; "the refund handler compares two numbers" is an implementation detail.
- **Read the implementation anyway** (API handlers, validation schemas, permission maps, state
  transitions, side effects such as ledger entries or emails) to find where it can disagree with the rule:
  a check done only in the UI, a status that isn't guarded, a side effect that isn't reversed, a rounding
  step, a missing tenant filter. Every such gap becomes a case, and if it already looks wrong, a
  **question for the owner** (never an expected result). Ask it in the session and record the answer in
  the brief's `## Decisions`.
- Expected results are **concrete**: amounts, quantities, statuses, who sees what. "The order shows 2,000
  refunded and 3,000 still paid", not "the refund is correct".

## 3. Cover the dirty paths that matter

Pick from this catalogue the items that are realistic for the feature. Each one needs a business reason.

| Kind | Examples |
| --- | --- |
| Boundary and bad input | 0, negative, decimals where only whole units make sense, very large values, thousands separators, empty optional fields, max length, leading/trailing spaces, duplicates of a value that should be unique (invoice number, email) |
| State abuse | Act twice (approve, pay, refund, cancel), act out of order (ship before payment), edit or cancel after the record is final, re-open a closed record, delete something others depend on |
| Permission abuse | A lower role doing a higher role's action, both where the app hides it and through a direct request; a user from another organization guessing an id |
| Integrity across features | After a sequence (create → approve → edit → re-approve → cancel), do balances, totals, availability and reports still agree? Is the history right? |
| Concurrency and repeats | Double-submit, two tabs editing the same record, two users taking the last seat at once, refresh mid-flow |
| Time and money | Backdated and future dates, period boundaries (month end, plan renewal), time zones, currency and rounding, partial payments, overpayment, refunds larger than the original |
| Recovery | A validation message then a fix, a failed save then a retry, a dropped connection mid-save: no half-written records, no duplicates |
| Visibility of consequences | The downstream place the owner checks: dashboard totals, ledger, availability calendar, invoice, export |

Skip anything the platform already guarantees and that the business doesn't care about (a text box
accepting text, a page rendering, framework-level routing).

## 4. No junk: fewer, stronger cases

Before handing cases over, prune:

- **One case per business outcome, not per input.** Validation of six inputs is one Scenario Outline with
  a data table of inputs and messages, not six cases. Permission checks for one action across roles is one
  case.
- **Journeys over fragments.** When the risk is in the chain (order → payment → stock → invoice), write one
  journey case with a check after each action (section 6). Split only when actions need different setups,
  or when a single failure would hide the others.
- **Drop** cases that only prove a page loads or something exists, that restate another case with a value
  of no business significance, that can't realistically fail, or that existing cases already cover.
- **Merge** cases whose actions are the same and only the expected value differs; use a data table.
- **Place each check at the cheapest level that can catch it** (`level` column). `ui` (the default) when
  the risk is in what a person sees or does; `api` when the browser adds nothing, such as a table of 20
  inputs and their messages (Playwright's `request`, still reported to TestRail), plus at most one `ui`
  case proving a message reaches the user; `unit` for a pure calculation (tax, rounding, a date rule) with
  no screen or stored record involved. `unit` cases aren't pushed to TestRail; the plan lists them under
  "For developers" so they aren't lost. `check` warns when a `ui` case has more than 5 data rows.
- **Stay within the budget for the area's risk tier** (from "Areas and risk tiers" in the business
  context): by default 6 cases for low, 12 for medium, 20 for high, counting `ui` and `api` rows
  (`cases.budget` in `.qa/config.json`). Every case over budget must name a risk the others don't cover;
  `check --tier=<tier>` names the lowest-scoring rows to cut first.
- **Every case gets scored by a fresh reader** (`scoring.md`): impact 1-3 (cosmetic, recoverable,
  money/data/access/legal) × likelihood 1-3 (rare, occasional, common). Impact 1 is a drop however common,
  unless the business context shows the owner asked for it; under 3 is a drop; a P1 needs impact 3; a
  duplicate merges; a Then nobody can see gets rewritten.

## 5. Writing the case: Gherkin in the business's words

Each case is one row in the cases CSV. Its `scenario` cell holds Given/When/Then lines, one per line;
`And` and `But` continue the line above. A non-technical owner should be able to read a case in ten
seconds and say whether it matters.

- **Title:** the business behaviour, 12 words or fewer. "A refund can never be more than the customer
  paid", not "Test refund button validation".
- **Given:** where the case starts, as facts about the business: who, which records, which amounts.
  "Given Ali paid 5,000 for order A-17", not "Given the user is on /orders/17".
- **When:** what the person does, as a business action. "When the store manager refunds 6,000", not "When
  the user types 6000 into the amount field and clicks Submit".
- **Then:** what a person can see afterwards: a number, a status, a quoted message, or who can see what.
  "Then the refund is refused with \"Refund is more than the amount paid\"", not "Then it works
  correctly".
- **3–7 lines.** Longer means two cases, or setup that belongs in `background`.
- **One action per scenario;** a journey may have up to 4 When/Then pairs (section 6).
- **Words:** use the glossary's terms and the names under "Names used in examples". No UI or technical
  words in `title` or `scenario`: click, button, selector, endpoint, status code, database, xpath and css
  are errors in `cases.mjs check`; page, field, screen, form, dropdown, URL and API are warnings (fine
  when the owner uses the word). Text in quotes is the app's own wording and isn't checked.
- **Technical hints go in `notes`:** test ids, routes, waits, what a stub hides. `notes` never reaches the
  owner's review and isn't checked.
- **Permission cases** stay in business terms: "Then Sara cannot see the refund option, and even a direct
  refund request is refused". The request details go in `notes`.
- **Several inputs, one behaviour:** a Scenario Outline. Write `<placeholders>` in the scenario and fill
  the `data` cell with a table whose header names them.
- **`background`:** Given lines every case in a section shares ("Given the store sells in PKR"). Write them
  in each row's `background` cell; the plan prints them once per section.

Also fill per row: `priority` from business impact × likelihood (P1 = money, stock, access or data loss in
a common flow; P2 = wrong but recoverable, or rare; P3 = cosmetic or convenience), `type` (Functional,
Security for permission and tenant cases, Regression for journeys guarding existing behaviour), `risks`
and one line of `why_it_matters`.

`node .qa/scripts/cases.mjs check <csv>` enforces the structure and the words. Fix every error; read every
warning and fix it unless the owner's own wording is the reason.

## 6. Journeys in Gherkin

A journey is one case with several When/Then pairs, each Then the checkpoint for the When before it:

```gherkin
Given Ali has 2 seats in the cart for the 7 pm show
When Ali pays 3,000
Then the booking shows CONFIRMED and the show has 2 fewer seats
When Ali cancels the booking the same day
Then Ali is refunded 3,000 and the 2 seats are free again
```

- Up to **4 pairs**. More means the chain has two risks: split it where a different setup begins.
- Each pair becomes one step in TestRail (the When lines) with its expected result (the Then lines), and
  one `test.step` in the generated spec, so a failure names the checkpoint that broke.
- Don't hide setup in a When. If a pair only gets the data ready, it belongs in Given.

## 7. Good and bad cases

**Money: concrete, not "correct"**

```gherkin
# Bad
Scenario: Test discount calculation
  Given the user is logged in and on the checkout page
  When the user enters code SAVE10 in the coupon field and clicks Apply
  Then the discount is calculated correctly

# Good
Scenario: A 10% coupon takes 10% off the order before delivery
  Given Ali has 4,000 of shoes and 300 delivery in the cart
  When Ali applies coupon SAVE10
  Then the order total is 3,900
```

**Permissions: one case, business words, request details in notes**

```gherkin
# Bad
Scenario: Staff role 403 on POST /api/refunds
  Given a staff JWT
  When a POST request is sent to the refunds endpoint
  Then the status code is 403

# Good
Scenario: Staff can't refund an order
  Given Sara is store staff and order A-17 is paid
  When Sara tries to refund order A-17
  Then Sara cannot see the refund option
  And even a direct refund request is refused, with nothing refunded
```

(`notes`: `Direct request: POST /api/orders/:id/refunds with Sara's session; expect 403 and no refund row.`)

**Validation: one outline, not one case per input**

```gherkin
# Bad: six cases like this one
Scenario: Quantity field rejects 0
  Given the user is on the add stock form
  When the user types 0 in the quantity field
  Then a validation error is shown

# Good
Scenario: Stock can only be received in whole, positive amounts
  Given Omar is receiving delivery D-3
  When Omar enters <amount> boxes received
  Then Omar sees "<message>" and the stock count doesn't change
```

(`data`: `amount | message` / `0 | Enter at least 1` / `-2 | Enter at least 1` / `1.5 | Enter whole boxes`.)

**State abuse: say what must not happen twice**

```gherkin
# Bad
Scenario: Double click on pay button
  Given the payment page is open
  When the user double-clicks Pay
  Then only one request is sent

# Good
Scenario: Paying twice in a hurry charges the customer once
  Given Ali's order A-17 for 5,000 is waiting for payment
  When Ali submits payment twice within a second
  Then Ali is charged 5,000 once
  And order A-17 shows PAID with one payment
```

**Visibility of consequences: check where the owner looks**

```gherkin
# Bad
Scenario: Invoice is created
  Given an order exists
  When the order is approved
  Then an invoice record is created in the database

# Good
Scenario: Approving an order puts it on this month's revenue report
  Given the revenue report shows 120,000 for October
  When the manager approves order A-17 for 5,000 on 30 October
  Then the October revenue report shows 125,000
  And order A-17 is listed on it
```

## 8. Review before handing over

Re-read the full set as the business owner would, and answer in the Gate 1 summary:

1. Which business risks are covered, by which case? (A short risk → case table.)
2. Which risks are not covered, and why (out of scope, needs data we don't have, open question)?
3. Which cases were merged or dropped, in one line each?
4. What in the implementation looked wrong or unguarded, and what the owner decided (the brief's
   `## Decisions`)?
