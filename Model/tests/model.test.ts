import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  advanceFulfillment, calculateTotals, createOrder, deleteOrder, DomainError,
  getOrderById, getOrderByToken, getProductBySlug, listPaidOrders, listProducts,
  migrate, openDatabase, payOrder, payOrderByMethod, seedProducts, seedProductsIfEmpty, simulatePayment,
} from "../src";
import type { DatabaseConnection, CreateOrderInput } from "../src";

let db: DatabaseConnection;

const checkout: CreateOrderInput = {
  items: [
    { productId: "chocolate-belga", quantity: 2 },
    { productId: "red-velvet", quantity: 1 },
  ],
  customer: { name: "Cliente Teste", email: "cliente@example.test", phone: "11999999999" },
  delivery: {
    zipCode: "01310100", street: "Avenida Exemplo", number: "123", complement: "",
    neighborhood: "Centro", city: "São Paulo", state: "SP",
  },
};

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  seedProducts(db);
});

afterEach(() => db.close());

describe("migração e catálogo", () => {
  it("classifica tentativas anteriores à migração de métodos como cartão", () => {
    const legacy = openDatabase(":memory:");
    try {
      legacy.exec(readFileSync("db/migrations/001_init.sql", "utf8"));
      seedProducts(legacy);
      const order = createOrder(legacy, checkout);
      legacy.prepare(`INSERT INTO payment_attempts (id, order_id, card_last4, outcome, created_at)
        VALUES (?, ?, ?, ?, ?)`).run("tentativa-antiga", order.id, "4242", "APPROVED", new Date().toISOString());
      migrate(legacy);
      expect(legacy.prepare("SELECT method, card_last4 FROM payment_attempts WHERE id = ?").get("tentativa-antiga"))
        .toEqual({ method: "CREDIT_CARD", card_last4: "4242" });
    } finally { legacy.close(); }
  });

  it("preserva pedido e preço alterado após reabrir o arquivo SQLite", () => {
    const folder = mkdtempSync(join(tmpdir(), "pit-cupcakes-"));
    const databasePath = join(folder, "orders.sqlite");
    try {
      const first = openDatabase(databasePath);
      let orderId: string;
      try {
        migrate(first);
        seedProductsIfEmpty(first);
        orderId = createOrder(first, checkout).id;
        first.prepare("UPDATE products SET price_cents = ? WHERE id = ?").run(1725, "chocolate-belga");
      } finally { first.close(); }
      const reopened = openDatabase(databasePath);
      try {
        migrate(reopened);
        seedProductsIfEmpty(reopened);
        expect(getOrderById(reopened, orderId)?.id).toBe(orderId);
        expect(getProductBySlug(reopened, "chocolate-belga")?.priceCents).toBe(1725);
      } finally { reopened.close(); }
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
  it("aplica migração e seed novamente sem duplicar produtos", () => {
    migrate(db);
    seedProducts(db);
    expect(listProducts(db)).toHaveLength(10);
    expect(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toEqual({ count: 5 });
  });

  it("troca imagens provisórias em banco existente sem alterar preço ou imagem personalizada", () => {
    db.prepare("UPDATE products SET image_path = ?, price_cents = ? WHERE id = ?")
      .run("/products/placeholder.svg", 1725, "chocolate-belga");
    db.prepare("UPDATE products SET image_path = ? WHERE id = ?")
      .run("/products/personalizada.jpg", "red-velvet");
    db.prepare("DELETE FROM schema_migrations WHERE name = ?").run("002_product_images.sql");
    migrate(db);
    expect(getProductBySlug(db, "chocolate-belga")).toMatchObject({
      imagePath: "/products/chocolate-belga.jpg", priceCents: 1725,
    });
    expect(getProductBySlug(db, "red-velvet")?.imagePath).toBe("/products/personalizada.jpg");
  });

  it("inicializa catálogo só no banco vazio e preserva alterações posteriores", () => {
    db.prepare("UPDATE products SET price_cents = ? WHERE id = ?").run(1725, "chocolate-belga");
    seedProductsIfEmpty(db);
    expect(getProductBySlug(db, "chocolate-belga")?.priceCents).toBe(1725);
    db.prepare("DELETE FROM products").run();
    seedProductsIfEmpty(db);
    expect(listProducts(db)).toHaveLength(10);
  });

  it("filtra produtos ativos por texto e categoria e mantém chaves estrangeiras", () => {
    expect(listProducts(db, { q: "chocolate", category: "Chocolate" })).toHaveLength(2);
    expect(getProductBySlug(db, "red-velvet")?.priceCents).toBe(1490);
    db.prepare("UPDATE products SET active = 0 WHERE id = ?").run("red-velvet");
    expect(getProductBySlug(db, "red-velvet")).toBeNull();
    expect(() => db.prepare(`INSERT INTO order_items (id, order_id, product_id, product_name,
      unit_price_cents, quantity, line_total_cents) VALUES ('x','ausente','red-velvet','x',100,1,100)`).run()).toThrow();
  });
});

describe("pedido e cálculo", () => {
  it("apaga pedido e remove itens e tentativas vinculados", () => {
    const order = createOrder(db, checkout);
    payOrder(db, order.id, order.publicToken, "4242424242424242");
    expect(db.prepare("SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?").get(order.id)).toEqual({ count: 2 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts WHERE order_id = ?").get(order.id)).toEqual({ count: 1 });
    expect(deleteOrder(db, order.id)).toBe(true);
    expect(getOrderByToken(db, order.publicToken)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?").get(order.id)).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts WHERE order_id = ?").get(order.id)).toEqual({ count: 0 });
    expect(deleteOrder(db, order.id)).toBe(false);
  });

  it("calcula centavos exatos e rejeita quantidades inválidas", () => {
    expect(calculateTotals([{ priceCents: 1290, quantity: 2 }, { priceCents: 1490, quantity: 1 }]))
      .toEqual({ subtotalCents: 4070, shippingCents: 890, totalCents: 4960 });
    for (const quantity of [0, -1, 1.5, 21]) {
      expect(() => calculateTotals([{ priceCents: 1290, quantity }])).toThrow(DomainError);
    }
  });

  it("relê preços do banco, congela itens e cria token imprevisível", () => {
    const forged = { ...checkout, totalCents: 1, items: checkout.items.map((item) => ({ ...item, priceCents: 1 })) };
    const order = createOrder(db, forged);
    expect(order.subtotalCents).toBe(4070);
    expect(order.totalCents).toBe(4960);
    expect(order.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(order.paymentStatus).toBe("PENDING");
    expect(getOrderByToken(db, order.publicToken)?.id).toBe(order.id);
    db.prepare("UPDATE products SET price_cents = 9999 WHERE id = ?").run("chocolate-belga");
    expect(getOrderById(db, order.id)?.items[0]?.unitPriceCents).toBe(1290);
    expect(getOrderById(db, order.id)?.totalCents).toBe(4960);
  });

  it("rejeita duplicados, produtos inativos e quantidade inválida sem pedido órfão", () => {
    const badInputs = [
      { ...checkout, items: [checkout.items[0]!, checkout.items[0]!] },
      { ...checkout, items: [{ productId: "ausente", quantity: 1 }] },
      { ...checkout, items: [{ productId: "chocolate-belga", quantity: 0 }] },
    ];
    for (const input of badInputs) expect(() => createOrder(db, input)).toThrow(DomainError);
    expect(db.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM order_items").get()).toEqual({ count: 0 });
  });
});

describe("pagamento e entrega", () => {
  it("confirma Pix e boleto simulados sem dados de cartão e mantém o total", () => {
    for (const method of ["PIX", "BOLETO"] as const) {
      const created = createOrder(db, checkout);
      const result = payOrderByMethod(db, created.id, created.publicToken, method);
      expect(result.outcome).toBe("APPROVED");
      expect(result.order.paymentStatus).toBe("APPROVED");
      expect(result.order.totalCents).toBe(created.totalCents);
      expect(result.order.paymentAttempts).toMatchObject([{ method, cardLast4: "", outcome: "APPROVED" }]);
      expect(() => payOrderByMethod(db, created.id, created.publicToken, method))
        .toThrowError(expect.objectContaining({ code: "ORDER_ALREADY_PAID" }));
    }
    expect(db.prepare("SELECT method, card_last4 FROM payment_attempts ORDER BY rowid").all())
      .toEqual([{ method: "PIX", card_last4: "" }, { method: "BOLETO", card_last4: "" }]);
  });

  it("rejeita cartão enviado para Pix sem registrar tentativa", () => {
    const created = createOrder(db, checkout);
    expect(() => payOrderByMethod(db, created.id, created.publicToken, "PIX", "4242424242424242"))
      .toThrowError(expect.objectContaining({ code: "INVALID_PAYMENT_METHOD" }));
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts").get()).toEqual({ count: 0 });
  });

  it("simula apenas os três cartões de demonstração", () => {
    expect(simulatePayment("4242 4242 4242 4242")).toBe("APPROVED");
    expect(simulatePayment("4000000000009995")).toBe("INSUFFICIENT_FUNDS");
    expect(simulatePayment("4000000000000002")).toBe("GENERIC_DECLINE");
    expect(() => simulatePayment("4111111111111111")).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_TEST_CARD" }));
  });

  it("persiste recusas, permite tentar de novo e não altera o total", () => {
    const created = createOrder(db, checkout);
    const insufficient = payOrder(db, created.id, created.publicToken, "4000000000009995");
    expect(insufficient.outcome).toBe("INSUFFICIENT_FUNDS");
    expect(insufficient.order.paymentStatus).toBe("DECLINED");
    expect(insufficient.order.fulfillmentStatus).toBe("AWAITING_PAYMENT");
    const generic = payOrder(db, created.id, created.publicToken, "4000000000000002");
    expect(generic.outcome).toBe("GENERIC_DECLINE");
    const approved = payOrder(db, created.id, created.publicToken, "4242 4242 4242 4242");
    expect(approved.order.paymentStatus).toBe("APPROVED");
    expect(approved.order.fulfillmentStatus).toBe("RECEIVED");
    expect(approved.order.totalCents).toBe(created.totalCents);
    expect(approved.order.paymentAttempts.map((attempt) => attempt.cardLast4)).toEqual(["9995", "0002", "4242"]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts").get()).toEqual({ count: 3 });
    expect(listPaidOrders(db)).toHaveLength(1);
    expect(() => payOrder(db, created.id, created.publicToken, "4242424242424242"))
      .toThrowError(expect.objectContaining({ code: "ORDER_ALREADY_PAID" }));
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts").get()).toEqual({ count: 3 });
  });

  it("não registra cartão inválido nem token incorreto", () => {
    const order = createOrder(db, checkout);
    expect(() => payOrder(db, order.id, "token-invalido", "4242424242424242"))
      .toThrowError(expect.objectContaining({ code: "TOKEN_MISMATCH" }));
    expect(() => payOrder(db, order.id, order.publicToken, "4111111111111111"))
      .toThrowError(expect.objectContaining({ code: "UNSUPPORTED_TEST_CARD" }));
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts").get()).toEqual({ count: 0 });
  });

  it("avança entrega somente após aprovação e na sequência definida", () => {
    const order = createOrder(db, checkout);
    expect(() => advanceFulfillment(db, order.id, "PREPARING"))
      .toThrowError(expect.objectContaining({ code: "INVALID_STATUS_TRANSITION" }));
    payOrder(db, order.id, order.publicToken, "4242424242424242");
    expect(() => advanceFulfillment(db, order.id, "DELIVERED"))
      .toThrowError(expect.objectContaining({ code: "INVALID_STATUS_TRANSITION" }));
    expect(advanceFulfillment(db, order.id, "PREPARING").fulfillmentStatus).toBe("PREPARING");
    expect(advanceFulfillment(db, order.id, "OUT_FOR_DELIVERY").fulfillmentStatus).toBe("OUT_FOR_DELIVERY");
    expect(advanceFulfillment(db, order.id, "DELIVERED").fulfillmentStatus).toBe("DELIVERED");
  });
});
