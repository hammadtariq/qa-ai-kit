// Kolachi Supplies: a small wholesale ordering app. In-memory data, no dependencies.
import { createServer } from 'node:http';
import { placeOrder } from './src/orders.mjs';
import { refundOrder } from './src/refunds.mjs';
import { db } from './src/db.mjs';

const USERS = {
  'sana@kolachi.test': { password: 'manager-pass', role: 'manager', name: 'Sana' },
  'omar@kolachi.test': { password: 'staff-pass', role: 'staff', name: 'Omar' },
  'bilal@shop.test': { password: 'shop-pass', role: 'shop', name: 'Bilal', customerId: 'C-1' },
};
const sessions = new Map();

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/html' : 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b ? JSON.parse(b) : {})); });
const userOf = (req) => sessions.get((req.headers.cookie || '').match(/sid=(\w+)/)?.[1]);

const page = (title, body) => `<!doctype html><html lang="en"><head><title>${title} - Kolachi Supplies</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const user = userOf(req);
  try {
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { email, password } = await readBody(req);
      const u = USERS[email];
      if (!u || u.password !== password) return send(res, 401, { error: 'Wrong email or password' });
      const sid = Math.random().toString(36).slice(2);
      sessions.set(sid, { email, ...u });
      res.setHeader('set-cookie', `sid=${sid}; HttpOnly; Path=/`);
      return send(res, 200, { name: u.name, role: u.role });
    }
    if (url.pathname === '/login') return send(res, 200, page('Sign in', '<form id="login"><label>Email <input name="email"></label><label>Password <input name="password" type="password"></label><button>Sign in</button></form>'));
    if (!user) return send(res, 401, { error: 'Sign in first' });

    if (req.method === 'GET' && url.pathname === '/api/products') return send(res, 200, db.products);
    if (req.method === 'GET' && url.pathname === '/api/orders') return send(res, 200, db.orders);
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const body = await readBody(req);
      // Shops order for themselves; staff and managers enter phone orders for any shop.
      const customerId = user.role === 'shop' ? user.customerId : body.customerId;
      return send(res, 201, placeOrder({ ...body, customerId, enteredBy: user.email }));
    }
    const refund = url.pathname.match(/^\/api\/orders\/([\w-]+)\/refunds$/);
    if (req.method === 'POST' && refund) {
      const body = await readBody(req);
      return send(res, 201, refundOrder(refund[1], body, user));
    }
    if (url.pathname.startsWith('/orders/')) {
      const order = db.orders.find((o) => o.id === url.pathname.split('/')[2]);
      if (!order) return send(res, 404, page('Not found', ''));
      // The refund form is only shown to managers.
      const form = user.role === 'manager' ? '<form id="refund"><label>Amount <input name="amount"></label><label>Reason <input name="reason"></label><button>Refund</button></form>' : '';
      return send(res, 200, page(`Order ${order.id}`, `<p>Total: Rs ${order.total}</p><p>Refunded: Rs ${order.refunded}</p>${form}`));
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}).listen(Number(process.env.PORT || 3100));
