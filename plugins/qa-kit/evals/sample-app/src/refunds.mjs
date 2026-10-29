import { db, nextId } from './db.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });

export function refundOrder(orderId, { amount, reason }, user) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) throw fail(404, 'No such order');
  if (!(amount > 0)) throw fail(400, 'Enter an amount');
  if (!reason) throw fail(400, 'Give a reason');
  const refund = { id: nextId('R', db.refunds), orderId, amount, reason, by: user.email, at: new Date().toISOString() };
  db.refunds.push(refund);
  order.refunded += amount;
  order.history.push(`refunded Rs ${amount}`);
  db.emails.push({ to: order.customerId, subject: `Refund for order ${order.id}`, text: `We refunded Rs ${amount}.` });
  return refund;
}
