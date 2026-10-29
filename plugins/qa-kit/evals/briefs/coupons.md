# Coupons at checkout (new feature)

Roles: shop bilal@shop.test, staff omar@kolachi.test. Test data: coupons EID10 and NEWSHOP15 from the seed.

Area and risk tier: coupons, medium

Why it matters: a coupon that fails on its last day brings loud complaints; a coupon used twice costs margin.

Acceptance criteria:
1. A shop enters a coupon when ordering and the total drops by the coupon's percentage, rounded to the
   nearest rupee.
2. A coupon works until the end of its last day, Karachi time, and is refused after that with "This coupon
   has expired".
3. Each shop can use a coupon once. Staff entering a phone order apply it to that shop's allowance.
4. Codes are not case-sensitive. An unknown code is refused and the order isn't placed.

## Decisions

| Question | Answer | Who | Date |
| --- | --- | --- | --- |
| Is the last day included? | Yes, the whole day until midnight Karachi time | Sana Qureshi | 2026-10-21 |
| Does a refused coupon stop the order? | Yes, the shop removes the code or fixes it, then orders | Sana Qureshi | 2026-10-21 |
| Can two coupons be combined? | No, one coupon per order (the form takes one) | Sana Qureshi | 2026-10-21 |

Open questions for the owner:
- none

Out of scope: creating coupons (managers do it in the database for now), refunds.
