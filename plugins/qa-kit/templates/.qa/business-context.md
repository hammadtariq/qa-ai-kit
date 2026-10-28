# Business context

Read by the QA Kit before planning or generating tests, so cases protect what this business cares about.
Filled by `/qa-kit:discover` (an interview with the product owner); re-run it to fill gaps or refresh old
facts. Keep it to about one page.

Every fact ends with its source: `(owner, YYYY-MM-DD)` when the owner confirmed it, `(code: path)` when it
was read from the repo and not contested, `(assumed)` when nobody confirmed it. Only `(owner, ...)` facts
justify a P1 case.

## The business
- **What it is, for whom:** BUSINESS_NICHE (assumed)
- **How it makes money:** VALUE (assumed)
- **Business type (risk packs):** PACKS, e.g. ecommerce, saas-billing (assumed)

## Roles
<!-- In the business's words. For each: what it must never do. -->
- ROLE_1: NEVER_1 (assumed)
- ROLE_2: NEVER_2 (assumed)
- **Organisations share the app:** yes / no (assumed)

## Key journeys
<!-- The 3 that bring in money or that users can't work without, and how each ends for the user. -->
- JOURNEY_1 (assumed)
- JOURNEY_2 (assumed)
- JOURNEY_3 (assumed)

## What must never go wrong
<!-- Ranked, worst first. One rule a test can prove per line, bold. Cases reference these numbers in their
     risks column, so keep a number once it's in use. These drive P1 cases. -->
1. **MONEY_RULE** (e.g. a refund never exceeds what was paid) (assumed)
2. **RECORD_RULE** (e.g. stock never goes below zero) (assumed)
3. **ACCESS_RULE** (e.g. one organisation never sees another's data) (assumed)

## Business rules and invariants
<!-- Rules that hold across features; each becomes an assertion somewhere. -->
- RULE_1 (assumed)

## Real-world usage (the "dirty" paths)
<!-- How real users actually behave; where mistakes and disputes happen. -->
- USAGE_1 (e.g. entries are often backdated at month end) (assumed)

## Past incidents and complaints
<!-- Anything that has gone wrong before. Each deserves a regression case. -->
- none recorded yet

## Outside services
<!-- Payments, email, SMS, sign-in, ERPs, webhooks. Tests use sandboxes; anything without one is stubbed. -->
| Service | What for | Test mode | In tests | Source |
| --- | --- | --- | --- | --- |
| SERVICE | PURPOSE | sandbox / none / unknown | test mode / test inbox / stub / unknown | (assumed) |

## Support promises
- **Browsers and devices:** Chrome desktop (assumed)
- **Languages, currencies, time zones:** LOCALES (assumed)

## Existing test coverage
<!-- What unit, API and manual testing already covers, so E2E doesn't repeat it. -->
- COVERAGE (assumed)

## Releases
- **How often:** FREQUENCY (assumed)
- **What a bad release costs:** COST (assumed)

## Test environment and data
- **Where tests run:** staging URL / local app (never production) (assumed)
- **Accounts per role:** ACCOUNTS (assumed)
- **Tests may create and delete data:** yes / create only / separate test organisation (assumed)

## Areas and risk tiers
<!-- high: money, access or data loss possible. medium: wrong but recoverable. low: cosmetic or rare.
     The tier sets each feature's case budget. -->
| Area | Tier | Why | Source |
| --- | --- | --- | --- |
| AREA | high | REASON | (assumed) |

## Open questions for the owner
- none

## Sources
<!-- Docs, PRDs and people this was drawn from, with dates. -->
- SOURCES
