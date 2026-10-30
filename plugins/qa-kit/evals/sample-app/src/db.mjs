// In-memory data, reset on restart.
export const db = {
  customers: [
    { id: 'C-1', shop: 'Bilal General Store' },
    { id: 'C-2', shop: 'Ayesha Mart' },
  ],
  products: [
    { sku: 'RICE-5', name: 'Basmati rice 5 kg', price: 2400, stock: 40 },
    { sku: 'OIL-3', name: 'Cooking oil 3 L', price: 1850, stock: 12 },
    { sku: 'TEA-1', name: 'Black tea 1 kg', price: 1300, stock: 5 },
  ],
  coupons: [
    // Expiry is the last day the coupon can be used, in Karachi time.
    { code: 'EID10', percent: 10, expires: '2026-11-30', usedBy: [] },
    { code: 'NEWSHOP15', percent: 15, expires: '2026-10-31', usedBy: [] },
  ],
  orders: [],
  refunds: [],
  emails: [],
};
export const nextId = (prefix, list) => `${prefix}-${list.length + 1}`;
