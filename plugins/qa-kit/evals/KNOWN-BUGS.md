# Known bugs in the sample app

Not copied into eval runs. Graders and people reading results use this list; a good plan finds these in the
code and keeps each as its own case with `known_issue` filled.

| Feature | Bug | Where |
| --- | --- | --- |
| refunds | Total refunded can exceed what the shop paid: no check against `paid - refunded` | `src/refunds.mjs` |
| refunds | Staff can refund through the API: only the page hides the form, the API checks no role | `src/refunds.mjs`, `server.mjs` |
| coupons | A coupon stops working at the start of its last day: `new Date('2026-10-31')` is midnight UTC, and the check isn't inclusive in Karachi time | `src/orders.mjs` `priceWithCoupon` |
| coupons | A shop can use the same coupon again: `usedBy` is recorded but never checked | `src/orders.mjs` |
| staff-orders | The same product twice in one order oversells: each line is checked against stock on its own | `src/orders.mjs` `placeOrder` |
| staff-orders | Submitting the same phone order twice places two orders: no duplicate guard | `src/orders.mjs`, `server.mjs` |
