# Glossary

The words test cases use, in the business's own language. Filled by `/qa-kit:discover`. A non-technical
owner should recognise every term. `node .qa/scripts/cases.mjs check` warns when a case uses a word from
the last column, or a capitalised word that isn't in this file.

| Term | Meaning | Say this, not |
| --- | --- | --- |
| Shop | a corner shop that buys from us | customer account, client, user |
| Order | what a shop buys in one go | transaction, record, cart |
| Phone order | an order staff enter for a shop | manual order, admin order |
| Stock | how many of a product we have to sell | inventory count, quantity field |
| Refund | money given back on an order | reversal, credit note, chargeback |
| Coupon | a code that takes a percentage off an order | promo, voucher, discount code |
| Manager | can refund and set prices and coupons | admin, superuser |
| Staff | takes phone orders | operator, agent |
| Total | what the shop pays for the order | amount field, grand total value |
| Rs | Pakistani rupees | PKR value, currency amount |

## Names used in examples

- Sana: Manager
- Omar: Staff
- Bilal: owner of Bilal General Store, a Shop
- Ayesha Mart: another Shop
- Basmati rice 5 kg (Rs 2,400), Cooking oil 3 L (Rs 1,850), Black tea 1 kg (Rs 1,300, 5 in stock)
- EID10 (10% off, last day 30 November), NEWSHOP15 (15% off, last day 31 October)
