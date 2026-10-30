# Phone orders by staff (new feature)

Roles: staff omar@kolachi.test, shop bilal@shop.test. Test data: products from the seed (Black tea has 5 in stock).

Area and risk tier: orders, high

Why it matters: we must never sell stock we don't have, and phone orders get submitted twice when the line drops.

Acceptance criteria:
1. Staff choose a shop and enter products and quantities; the order is placed for that shop with its total,
   and stock goes down by what was ordered.
2. An order for more than is in stock is refused with how many are left, and nothing is placed.
3. Submitting the same phone order twice within a minute places it once.
4. A shop ordering for itself can only order for its own shop.
5. A shop must be chosen and at least one product with a quantity of 1 or more.

## Decisions

| Question | Answer | Who | Date |
| --- | --- | --- | --- |
| Is stock taken when the order is placed or when it's delivered? | When it's placed | Sana Qureshi | 2026-10-21 |
| What counts as "the same order" when submitted twice? | Same shop, same products and quantities, within one minute | Sana Qureshi | 2026-10-21 |
| Can staff see other shops' orders? | Yes, staff see all orders; shops see only their own | Sana Qureshi | 2026-10-21 |

Open questions for the owner:
- none

Out of scope: coupons, refunds, delivery.
