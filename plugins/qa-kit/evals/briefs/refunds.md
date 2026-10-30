# Partial refunds (new feature)

Roles: manager sana@kolachi.test, staff omar@kolachi.test. Test data: orders placed by the test itself.

Area and risk tier: refunds, high

Why it matters: refunds are money leaving the business; in March a typo refunded Rs 48,000 on a Rs 4,800 order.

Acceptance criteria:
1. A manager refunds part or all of an order with an amount and a reason; the order shows the amount
   refunded so far and its history lists the refund.
2. The shop gets an email saying how much was refunded.
3. The total refunded on an order can never go above what the shop paid, over one refund or several.
4. Only managers can refund. Staff and shops can't, in the app or any other way.
5. Amount and reason are required; the amount is more than zero.

Business rules and invariants:
- Amount still refundable = paid - refunded so far.

## Decisions

| Question | Answer | Who | Date |
| --- | --- | --- | --- |
| Can a manager refund an order in several steps? | Yes, as long as the total stays within what was paid | Sana Qureshi | 2026-10-21 |
| Does a refund put the goods back into stock? | No, refunds are money only; returns are handled by hand | Sana Qureshi | 2026-10-21 |
| What should the manager see when the amount is too high? | A message with the most they can still refund | Sana Qureshi | 2026-10-21 |

Open questions for the owner:
- none

Out of scope: placing orders, coupons.
