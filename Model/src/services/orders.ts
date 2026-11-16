import { randomBytes, randomUUID } from "node:crypto";
import type { DatabaseConnection } from "../db/connection";
import { DomainError } from "../errors";
import { getProductById } from "../repositories/products";
import { getOrderById, insertOrder, recordPayment, setFulfillmentStatus } from "../repositories/orders";
import type { CreateOrderInput, FulfillmentStatus, Order, PaymentAttempt, PaymentMethod } from "../types";
import { lastFourDigits, simulatePayment } from "./payment";
import { calculateLineTotal, calculateTotals, MAX_QUANTITY } from "./pricing";

function assertValidItems(items: CreateOrderInput["items"]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new DomainError("INVALID_ITEMS", "Adicione ao menos um cupcake.");
  }
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.productId !== "string" || !item.productId.trim() ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY ||
      ids.has(item.productId)) {
      throw new DomainError("INVALID_ITEMS", "Itens duplicados ou quantidades inválidas.");
    }
    ids.add(item.productId);
  }
}

export function createOrder(db: DatabaseConnection, input: CreateOrderInput): Order {
  return db.transaction(() => {
    assertValidItems(input.items);
    const items = input.items.map(({ productId, quantity }) => {
      const product = getProductById(db, productId);
      if (!product) throw new DomainError("PRODUCT_UNAVAILABLE", "Cupcake indisponível.");
      return {
        id: randomUUID(), productId: product.id, productName: product.name,
        unitPriceCents: product.priceCents, quantity,
        lineTotalCents: calculateLineTotal(product.priceCents, quantity),
      };
    });
    const totals = calculateTotals(items.map((item) => ({ priceCents: item.unitPriceCents, quantity: item.quantity })));
    const order: Order = {
      id: randomUUID(), publicToken: randomBytes(32).toString("base64url"),
      customer: input.customer, delivery: input.delivery, ...totals,
      paymentStatus: "PENDING", fulfillmentStatus: "AWAITING_PAYMENT",
      createdAt: new Date().toISOString(), paidAt: null, items, paymentAttempts: [],
    };
    insertOrder(db, order);
    return order;
  })();
}

export function payOrderByMethod(
  db: DatabaseConnection, id: string, publicToken: string, method: PaymentMethod, testCardNumber?: string,
): { outcome: PaymentAttempt["outcome"]; order: Order } {
  return db.transaction(() => {
    const existing = getOrderById(db, id);
    if (!existing) throw new DomainError("ORDER_NOT_FOUND", "Pedido não encontrado.");
    if (existing.publicToken !== publicToken) throw new DomainError("TOKEN_MISMATCH", "Pedido não encontrado.");
    if (existing.paymentStatus === "APPROVED") throw new DomainError("ORDER_ALREADY_PAID", "Este pedido já foi pago.");
    const outcome = method === "CREDIT_CARD"
      ? simulatePayment(testCardNumber ?? "")
      : method === "PIX" || method === "BOLETO" ? "APPROVED" : null;
    if (!outcome || (method !== "CREDIT_CARD" && testCardNumber)) {
      throw new DomainError("INVALID_PAYMENT_METHOD", "Escolha uma forma de pagamento de demonstração válida.");
    }
    const now = new Date().toISOString();
    const attempt: PaymentAttempt = {
      id: randomUUID(), method, cardLast4: method === "CREDIT_CARD" ? lastFourDigits(testCardNumber ?? "") : "",
      outcome, createdAt: now,
    };
    const approved = outcome === "APPROVED";
    if (!recordPayment(db, id, attempt, approved ? "APPROVED" : "DECLINED", approved ? "RECEIVED" : "AWAITING_PAYMENT", approved ? now : null)) {
      throw new DomainError("ORDER_ALREADY_PAID", "Este pedido já foi pago.");
    }
    const order = getOrderById(db, id);
    if (!order) throw new DomainError("ORDER_NOT_FOUND", "Pedido não encontrado.");
    return { outcome, order };
  })();
}

export function payOrder(db: DatabaseConnection, id: string, publicToken: string, testCardNumber: string) {
  return payOrderByMethod(db, id, publicToken, "CREDIT_CARD", testCardNumber);
}

const nextStatus: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = {
  RECEIVED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export function advanceFulfillment(db: DatabaseConnection, id: string, target: FulfillmentStatus): Order {
  return db.transaction(() => {
    const current = getOrderById(db, id);
    if (!current) throw new DomainError("ORDER_NOT_FOUND", "Pedido não encontrado.");
    if (current.paymentStatus !== "APPROVED" || nextStatus[current.fulfillmentStatus] !== target ||
      !setFulfillmentStatus(db, id, current.fulfillmentStatus, target)) {
      throw new DomainError("INVALID_STATUS_TRANSITION", "Avanço de entrega inválido.");
    }
    const updated = getOrderById(db, id);
    if (!updated) throw new DomainError("ORDER_NOT_FOUND", "Pedido não encontrado.");
    return updated;
  })();
}
