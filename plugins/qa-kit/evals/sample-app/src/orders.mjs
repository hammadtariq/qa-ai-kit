import { db, nextId } from './db.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });

export function priceWithCoupon(subtotal, code, customerId, now = new Date()) {
  if (!code) return { total: subtotal, discount: 0 };
  const coupon = db.coupons.find((c) => c.code === code.toUpperCase());
  if (!coupon) throw fail(400, 'Unknown coupon');
  if (new Date(coupon.expires) < now) throw fail(400, 'This coupon has expired');
  const discount = Math.round((subtotal * coupon.percent) / 100);
  coupon.usedBy.push(customerId);
  return { total: subtotal - discount, discount };
}

export function placeOrder({ customerId, items = [], coupon, enteredBy }) {
  if (!db.customers.some((c) => c.id === customerId)) throw fail(400, 'Choose a shop');
  if (!items.length) throw fail(400, 'Add at least one product');
  let subtotal = 0;
  for (const { sku, qty } of items) {
    const product = db.products.find((p) => p.sku === sku);
    if (!product) throw fail(400, `Unknown product ${sku}`);
    if (!(qty > 0)) throw fail(400, 'Quantity must be at least 1');
    if (qty > product.stock) throw fail(409, `Only ${product.stock} of ${product.name} left`);
    subtotal += product.price * qty;
  }
  for (const { sku, qty } of items) db.products.find((p) => p.sku === sku).stock -= qty;
  const { total, discount } = priceWithCoupon(subtotal, coupon, customerId);
  const order = { id: nextId('A', db.orders), customerId, items, subtotal, discount, total, paid: total, refunded: 0, enteredBy, history: ['placed'] };
  db.orders.push(order);
  return order;
}
