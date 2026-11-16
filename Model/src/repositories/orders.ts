import type { DatabaseConnection } from "../db/connection";
import type { FulfillmentStatus, Order, OrderItem, PaymentAttempt, PaymentOutcome, PaymentStatus } from "../types";

interface OrderRow {
  id: string;
  publicToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  zipCode: string;
  street: string;
  streetNumber: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  paidAt: string | null;
}

const selectOrder = `SELECT id, public_token AS publicToken, customer_name AS customerName,
  customer_email AS customerEmail, customer_phone AS customerPhone, zip_code AS zipCode,
  street, street_number AS streetNumber, complement, neighborhood, city, state,
  subtotal_cents AS subtotalCents, shipping_cents AS shippingCents, total_cents AS totalCents,
  payment_status AS paymentStatus, fulfillment_status AS fulfillmentStatus,
  created_at AS createdAt, paid_at AS paidAt FROM orders`;

function mapOrder(db: DatabaseConnection, row: OrderRow): Order {
  const items = db.prepare(`SELECT id, product_id AS productId, product_name AS productName,
    unit_price_cents AS unitPriceCents, quantity, line_total_cents AS lineTotalCents
    FROM order_items WHERE order_id = ? ORDER BY rowid`).all(row.id) as OrderItem[];
  const paymentAttempts = db.prepare(`SELECT id, method, card_last4 AS cardLast4, outcome,
    created_at AS createdAt FROM payment_attempts WHERE order_id = ? ORDER BY rowid`).all(row.id) as PaymentAttempt[];
  return {
    id: row.id,
    publicToken: row.publicToken,
    customer: { name: row.customerName, email: row.customerEmail, phone: row.customerPhone },
    delivery: {
      zipCode: row.zipCode, street: row.street, number: row.streetNumber,
      complement: row.complement ?? "", neighborhood: row.neighborhood,
      city: row.city, state: row.state,
    },
    subtotalCents: row.subtotalCents,
    shippingCents: row.shippingCents,
    totalCents: row.totalCents,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    items,
    paymentAttempts,
  };
}

export function getOrderById(db: DatabaseConnection, id: string): Order | null {
  const row = db.prepare(`${selectOrder} WHERE id = ?`).get(id) as OrderRow | undefined;
  return row ? mapOrder(db, row) : null;
}

export function getOrderByToken(db: DatabaseConnection, token: string): Order | null {
  const row = db.prepare(`${selectOrder} WHERE public_token = ?`).get(token) as OrderRow | undefined;
  return row ? mapOrder(db, row) : null;
}

export function listPaidOrders(db: DatabaseConnection): Order[] {
  const rows = db.prepare(`${selectOrder} WHERE payment_status = 'APPROVED' ORDER BY created_at DESC`).all() as OrderRow[];
  return rows.map((row) => mapOrder(db, row));
}

export function listOrders(db: DatabaseConnection): Order[] {
  const rows = db.prepare(`${selectOrder} ORDER BY created_at DESC, id DESC`).all() as OrderRow[];
  return rows.map((row) => mapOrder(db, row));
}

export function deleteOrder(db: DatabaseConnection, id: string): boolean {
  return db.prepare("DELETE FROM orders WHERE id = ?").run(id).changes > 0;
}

export function insertOrder(db: DatabaseConnection, order: Order): void {
  db.prepare(`INSERT INTO orders (id, public_token, customer_name, customer_email,
    customer_phone, zip_code, street, street_number, complement, neighborhood,
    city, state, subtotal_cents, shipping_cents, total_cents, payment_status,
    fulfillment_status, created_at, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(order.id, order.publicToken, order.customer.name, order.customer.email,
      order.customer.phone, order.delivery.zipCode, order.delivery.street,
      order.delivery.number, order.delivery.complement, order.delivery.neighborhood,
      order.delivery.city, order.delivery.state, order.subtotalCents,
      order.shippingCents, order.totalCents, order.paymentStatus,
      order.fulfillmentStatus, order.createdAt, order.paidAt);
  const insertItem = db.prepare(`INSERT INTO order_items (id, order_id, product_id,
    product_name, unit_price_cents, quantity, line_total_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const item of order.items) {
    insertItem.run(item.id, order.id, item.productId, item.productName,
      item.unitPriceCents, item.quantity, item.lineTotalCents);
  }
}

export function recordPayment(
  db: DatabaseConnection,
  orderId: string,
  attempt: PaymentAttempt,
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus,
  paidAt: string | null,
): boolean {
  const updated = db.prepare(`UPDATE orders SET payment_status = ?, fulfillment_status = ?, paid_at = ?
    WHERE id = ? AND payment_status != 'APPROVED'`)
    .run(paymentStatus, fulfillmentStatus, paidAt, orderId);
  if (updated.changes !== 1) return false;
  db.prepare(`INSERT INTO payment_attempts (id, order_id, method, card_last4, outcome, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(attempt.id, orderId, attempt.method, attempt.cardLast4, attempt.outcome as PaymentOutcome, attempt.createdAt);
  return true;
}

export function setFulfillmentStatus(
  db: DatabaseConnection, orderId: string, expected: FulfillmentStatus, next: FulfillmentStatus,
): boolean {
  const result = db.prepare(`UPDATE orders SET fulfillment_status = ?
    WHERE id = ? AND fulfillment_status = ? AND payment_status = 'APPROVED'`)
    .run(next, orderId, expected);
  return result.changes === 1;
}
