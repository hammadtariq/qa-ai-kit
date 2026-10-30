# E-commerce

**Usual disasters:** a customer charged twice or charged the wrong total; an item sold that isn't in stock;
a coupon or sale price applied when it shouldn't be (or stacking); a refund larger than the payment; an
order paid but never fulfilled; another customer's address or order visible.

**Dirty paths:** submitting payment twice; going back after paying; the last unit bought by two people at
once; coupon applied then the cart changed; partial refund then a full refund; address edited after
dispatch; payment provider times out but the charge goes through.

**Where the owner looks:** orders list and status, stock count, payment provider dashboard, refunds report,
daily sales total, delivery labels.

**Questions:** What happens to stock when an order is cancelled or refunded? Can coupons stack? Which
order statuses can still be edited or cancelled? Who can refund, and up to how much?
