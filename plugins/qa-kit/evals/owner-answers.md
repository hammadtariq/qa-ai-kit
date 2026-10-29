# Owner's answers (for unattended eval runs)

Sana Qureshi, operations manager and owner of Kolachi Supplies, answered the discover questions on
2026-10-20. Use these as the owner's answers, tagged `(owner, 2026-10-20)`. Anything not answered here is
`(assumed)`.

1. **The product:** wholesale ordering for corner shops in Karachi. We earn on the margin of every order.
   Business type: ecommerce (B2B wholesale).
2. **People and roles:** shops (they order for themselves), staff (take phone orders for any shop; must
   never refund), managers (refunds, prices, coupons). One company; shops never see each other's orders.
3. **Journeys that matter:** a shop places an order and sees its total; staff enter a phone order for a
   shop; a manager refunds part or all of an order.
4. **What must never go wrong, worst first:**
   1. We refund more than the shop paid. It happened in March: Rs 48,000 went out on a Rs 4,800 order (typo).
   2. Someone other than a manager refunds money.
   3. We sell stock we don't have; the van arrives without the goods.
   4. A shop is charged twice for one order (phone orders get submitted twice when the line drops).
   5. A coupon fails on its last day, or a shop uses the same coupon twice. Shops complain loudly about
      the first; the second costs us margin.
5. **Past incidents:** the March over-refund (above); duplicate phone orders about once a week.
6. **Outside services:** email receipts and refund notices (SMTP, a test inbox is fine in tests). No card
   payments: shops pay cash on delivery.
7. **Support:** Chrome on desktop for staff and managers; Chrome on Android for shops. Prices in PKR, all
   dates in Karachi time. Accessibility: we'd like it, it isn't required.
8. **Existing tests:** none.
9. **Releases:** every few weeks; a bad release costs refunds and angry shops within hours.
10. **Test environment:** a copy of the app started locally or in CI; one test account per role (manager,
    staff, shop); tests may create and delete their own data.

**Areas and risk tiers:** refunds high (money out), orders high (stock and double charges), coupons medium
(margin, recoverable), catalogue low.
