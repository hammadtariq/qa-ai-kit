# Business context

Read by the QA Kit before planning or generating tests, so cases protect what this business cares about.
Filled by `/qa-kit:discover` (an interview with the product owner); re-run it to fill gaps or refresh old
facts. Keep it to about one page.

Every fact ends with its source: `(owner, YYYY-MM-DD)` when the owner confirmed it, `(code: path)` when it
was read from the repo and not contested, `(assumed)` when nobody confirmed it. Only `(owner, ...)` facts
justify a P1 case.

## The business
- **What it is, for whom:** wholesale ordering for corner shops in Karachi (owner, 2026-10-20)
- **How it makes money:** the margin on every order; shops pay cash on delivery (owner, 2026-10-20)
- **Business type (risk packs):** ecommerce (owner, 2026-10-20)

## Roles
- Shop: orders for itself; never sees another shop's orders (owner, 2026-10-20)
- Staff: enters phone orders for any shop; must never refund (owner, 2026-10-20)
- Manager: refunds, prices and coupons (owner, 2026-10-20)
- **Organisations share the app:** no, one company (owner, 2026-10-20)

## Key journeys
- A shop places an order and sees its total (owner, 2026-10-20)
- Staff enter a phone order for a shop (owner, 2026-10-20)
- A manager refunds part or all of an order (owner, 2026-10-20)

## What must never go wrong
1. **The total refunded on an order never exceeds what the shop paid** (owner, 2026-10-20)
2. **Only a manager can refund, in the app or any other way** (owner, 2026-10-20)
3. **We never sell more of a product than we have in stock** (owner, 2026-10-20)
4. **One order is placed and charged once, even if it is submitted twice** (owner, 2026-10-20)
5. **A coupon works through the whole of its last day in Karachi time, and once per shop** (owner, 2026-10-20)

## Business rules and invariants
- Order total = sum of price x quantity, minus the coupon discount (code: src/orders.mjs)
- Amount still refundable = paid - refunded so far (owner, 2026-10-20)

## Real-world usage (the "dirty" paths)
- Phone orders get submitted twice when the line drops, about once a week (owner, 2026-10-20)
- Refund amounts are typed by hand; typos happen (owner, 2026-10-20)

## Past incidents and complaints
- March 2026: Rs 48,000 refunded on a Rs 4,800 order (owner, 2026-10-20)
- Duplicate phone orders, about weekly (owner, 2026-10-20)

## Outside services
| Service | What for | Test mode | In tests | Source |
| --- | --- | --- | --- | --- |
| Email (SMTP) | receipts and refund notices | test inbox | test inbox | (owner, 2026-10-20) |

## Support promises
- **Browsers and devices:** Chrome desktop (staff, managers), Chrome on Android (shops) (owner, 2026-10-20)
- **Languages, currencies, time zones:** English, PKR, Asia/Karachi (owner, 2026-10-20)

## Existing test coverage
- none (owner, 2026-10-20)

## Releases
- **How often:** every few weeks (owner, 2026-10-20)
- **What a bad release costs:** refunds and angry shops within hours (owner, 2026-10-20)

## Test environment and data
- **Where tests run:** local app (owner, 2026-10-20)
- **Accounts per role:** manager, staff, shop (owner, 2026-10-20)
- **Tests may create and delete data:** yes (owner, 2026-10-20)

## Areas and risk tiers
| Area | Tier | Why | Source |
| --- | --- | --- | --- |
| refunds | high | money leaves the business | (owner, 2026-10-20) |
| orders | high | stock and double charges | (owner, 2026-10-20) |
| coupons | medium | margin, recoverable | (owner, 2026-10-20) |
| catalogue | low | prices are checked on delivery | (owner, 2026-10-20) |

## Open questions for the owner
- none

## Sources
- Interview with Sana Qureshi, operations manager, 2026-10-20
