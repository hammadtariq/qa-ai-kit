# Risk packs

One short file per kind of business. `/qa-kit:discover` picks the packs that fit (recorded under
"Business type" in `.qa/business-context.md`) and uses them to draft answers and follow-up questions.
`plan-feature` reads them while designing cases.

A pack is a prompt for thinking, never a list of cases: use an item only when the owner confirmed it
matters, or the feature in front of you can cause it. A product can match more than one pack (a
marketplace with subscriptions uses `marketplace` and `saas-billing`).

| Pack | For |
| --- | --- |
| `ecommerce` | Shops selling goods: cart, checkout, stock, delivery, returns |
| `saas-billing` | Subscriptions: plans, limits, trials, renewals, invoices |
| `booking` | Slots and capacity: appointments, tables, seats, rooms, rentals |
| `marketplace` | Buyers and sellers: listings, orders, commission, payouts, disputes |
| `fintech-ledger` | Money held or moved: wallets, ledgers, transfers, statements |
| `content-cms` | Publishing: drafts, review, publish, roles, scheduled content |
| `internal-admin` | Back-office tools: approvals, records, imports, reports |
| `healthcare` | Patients and care: appointments, records, prescriptions, privacy |

Each pack has the same four parts: usual disasters, dirty paths users really hit, where the owner looks,
and questions that turn a vague worry into a checkable rule.
