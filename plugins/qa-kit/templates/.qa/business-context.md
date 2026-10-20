# Business context

Read by the QA Kit before planning or generating tests, so cases protect what this business cares about.
Keep it to one page; update it when you learn something (a rule, a past incident, a customer complaint).

## The business
- **Niche and customers:** BUSINESS_NICHE (who uses the product, for what, in which market)
- **How it makes or saves money for them:** VALUE
- **Who uses it day to day, and their roles:** ROLES

## What must never go wrong
<!-- Ranked. These drive P1 cases. -->
1. MONEY_RULE (e.g. ledger balances always equal the sum of entries)
2. STOCK_OR_RECORD_RULE (e.g. stock on hand never goes negative and matches approved movements)
3. ACCESS_RULE (e.g. staff can't approve or delete; one organization never sees another's data)

## Business rules and invariants
<!-- Rules that hold across features; each becomes an assertion somewhere. -->
- RULE_1
- RULE_2

## Real-world usage (the "dirty" paths)
<!-- How real users actually behave; where mistakes and disputes happen. -->
- USAGE_1 (e.g. entries are often backdated at month end)
- USAGE_2 (e.g. two staff work on the same orders from different devices)

## Past incidents and complaints
<!-- Anything that has gone wrong before. Each deserves a regression case. -->
- none recorded yet

## Sources
<!-- Product docs, PRDs and people this was drawn from. -->
- SOURCES
