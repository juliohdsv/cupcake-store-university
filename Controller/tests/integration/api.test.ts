import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate, openDatabase, seedProducts } from "@pit/model";
import type { DatabaseConnection } from "@pit/model";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app";

let db: DatabaseConnection;
let app: FastifyInstance;

const validOrder = {
  items: [{ productId: "chocolate-belga", quantity: 2 }, { productId: "red-velvet", quantity: 1 }],
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
  app = buildApp({ db, adminPassword: "senha-de-teste", ownerUsername: "engenheiro", ownerPassword: "senha-oficial-de-teste", sessionKey: "chave-de-sessao-de-teste", webOrigin: "http://localhost:3000" });
});
afterEach(async () => {
  await app.close();
  db.close();
});

async function create() {
  const response = await app.inject({ method: "POST", url: "/api/v1/orders", payload: validOrder });
  expect(response.statusCode).toBe(201);
  return response.json().order as { id: string; publicToken: string; totalCents: number };
}

describe("API pública", () => {
  it("processa Pix e boleto simulados e valida combinação de método e cartão", async () => {
    for (const method of ["PIX", "BOLETO"] as const) {
      const order = await create();
      const response = await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`,
        payload: { publicToken: order.publicToken, method } });
      expect(response.statusCode).toBe(200);
      expect(response.json().payment).toEqual({ method, outcome: "APPROVED" });
      expect(response.json().order.paymentAttempts).toMatchObject([{ method, cardLast4: "" }]);
      expect(response.json().order.totalCents).toBe(order.totalCents);
    }
    const order = await create();
    for (const payload of [
      { publicToken: order.publicToken, method: "PIX", testCardNumber: "4242424242424242" },
      { publicToken: order.publicToken, method: "CREDIT_CARD" },
      { publicToken: order.publicToken, method: "TRANSFERENCIA" },
    ]) {
      const response = await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`, payload });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    }
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts").get()).toEqual({ count: 2 });
  });

  it("valida e persiste avaliação com captura opcional no SQLite", async () => {
    const payload = {
      reviewerName: "Pessoa Avaliadora", testDate: "2026-11-16",
      worked: "Carrinho e checkout funcionaram.", failed: "", notTested: "Painel admin.",
      suggestions: "Aumentar o contraste.", rating: 4,
    };
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    const created = await app.inject({ method: "POST", url: "/api/v1/site-reviews", payload: {
      ...payload, screenshot: { mimeType: "image/png", dataBase64: image.toString("base64") },
    } });
    expect(created.statusCode).toBe(201);
    expect(created.json().review.id).toMatch(/^[0-9a-f-]{36}$/);
    const row = db.prepare("SELECT reviewer_name, test_date, worked, failed, not_tested, suggestions, rating, screenshot_mime, screenshot_data FROM site_reviews").get() as {
      reviewer_name: string; test_date: string; worked: string; failed: string;
      not_tested: string; suggestions: string; rating: number; screenshot_mime: string; screenshot_data: Buffer;
    };
    expect(row).toMatchObject({ reviewer_name: payload.reviewerName, test_date: payload.testDate,
      worked: payload.worked, failed: payload.failed, not_tested: payload.notTested,
      suggestions: payload.suggestions, rating: payload.rating, screenshot_mime: "image/png" });
    expect(row.screenshot_data.equals(image)).toBe(true);

    const withoutImage = await app.inject({ method: "POST", url: "/api/v1/site-reviews", payload: { ...payload, reviewerName: "Outra pessoa" } });
    expect(withoutImage.statusCode).toBe(201);
    expect(db.prepare("SELECT COUNT(*) AS count FROM site_reviews").get()).toEqual({ count: 2 });
  });

  it("publica apenas avaliações autorizadas e permite consulta privada pelo administrador", async () => {
    const base = {
      testDate: "2026-11-16", worked: "Carrinho funcionou.", failed: "Busca falhou.",
      notTested: "Entrega.", suggestions: "Melhorar busca.", rating: 5,
    };
    const publicReview = await app.inject({ method: "POST", url: "/api/v1/site-reviews", payload: {
      ...base, reviewerName: "Pessoa Pública", publicationConsent: true,
    } });
    const privateReview = await app.inject({ method: "POST", url: "/api/v1/site-reviews", payload: {
      ...base, reviewerName: "Pessoa Privada", publicationConsent: false,
    } });
    const publicId = publicReview.json().review.id;
    const privateId = privateReview.json().review.id;
    const publicList = await app.inject("/api/v1/site-reviews");
    expect(publicList.json().items).toMatchObject([{ id: publicId, reviewerName: "Pessoa Pública", publicationConsent: true }]);
    expect((await app.inject(`/api/v1/site-reviews/${publicId}`)).json().review).toMatchObject(base);
    expect((await app.inject(`/api/v1/site-reviews/${privateId}`)).statusCode).toBe(404);
    expect((await app.inject("/api/v1/admin/site-reviews")).statusCode).toBe(401);
    expect((await app.inject(`/api/v1/admin/site-reviews/${privateId}`)).statusCode).toBe(401);
    const login = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "senha-de-teste" } });
    const headers = { cookie: String(login.headers["set-cookie"]).split(";")[0]! };
    const all = await app.inject({ method: "GET", url: "/api/v1/admin/site-reviews", headers });
    expect(all.json().items).toHaveLength(2);
    expect((await app.inject({ method: "GET", url: `/api/v1/admin/site-reviews/${privateId}`, headers })).json().review)
      .toMatchObject({ reviewerName: "Pessoa Privada", publicationConsent: false, ...base });
  });

  it("recusa avaliação inválida e imagem forjada sem gravar dados", async () => {
    const base = { reviewerName: "Pessoa", testDate: "2026-11-16", worked: "", failed: "", notTested: "", suggestions: "", rating: 3 };
    for (const payload of [
      { ...base, reviewerName: "A" },
      { ...base, testDate: "2026-02-30" },
      { ...base, rating: 0 },
      { ...base, extra: "ignorado?" },
      { ...base, screenshot: { mimeType: "image/png", dataBase64: Buffer.from("não é imagem").toString("base64") } },
    ]) {
      const response = await app.inject({ method: "POST", url: "/api/v1/site-reviews", payload });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    }
    expect(db.prepare("SELECT COUNT(*) AS count FROM site_reviews").get()).toEqual({ count: 0 });
  });

  it("expõe healthcheck, catálogo filtrado e detalhe", async () => {
    expect((await app.inject("/api/v1/health")).json()).toEqual({ status: "ok" });
    const products = await app.inject("/api/v1/products?q=chocolate&category=Chocolate");
    expect(products.statusCode).toBe(200);
    expect(products.json().items).toHaveLength(2);
    const detail = await app.inject("/api/v1/products/red-velvet");
    expect(detail.json().product.priceCents).toBe(1490);
    expect((await app.inject("/api/v1/products/inexistente")).statusCode).toBe(404);
  });

  it("valida corpo e consulta estritamente, sem aceitar preço enviado pelo cliente", async () => {
    const forged = await app.inject({ method: "POST", url: "/api/v1/orders", payload: { ...validOrder, totalCents: 1 } });
    expect(forged.statusCode).toBe(400);
    expect(forged.json().error.code).toBe("VALIDATION_ERROR");
    const invalid = await app.inject({ method: "POST", url: "/api/v1/orders", payload: {
      ...validOrder, items: [{ productId: "chocolate-belga", quantity: 0 }],
      customer: { ...validOrder.customer, email: "invalido" },
    } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "items.0.quantity" }),
      expect.objectContaining({ field: "customer.email" }),
    ]));
    expect((await app.inject("/api/v1/products?preco=1")).statusCode).toBe(400);
    expect(db.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
  });

  it("responde JSON malformado com erro uniforme", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/orders",
      headers: { "content-type": "application/json" }, payload: "{invalido" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("recalcula total e não salva pedido com produto ausente ou inativo", async () => {
    const unavailable = await app.inject({ method: "POST", url: "/api/v1/orders", payload: {
      ...validOrder, items: [{ productId: "ausente", quantity: 1 }],
    } });
    expect(unavailable.statusCode).toBe(422);
    db.prepare("UPDATE products SET active=0 WHERE id=?").run("red-velvet");
    const inactive = await app.inject({ method: "POST", url: "/api/v1/orders", payload: validOrder });
    expect(inactive.statusCode).toBe(422);
    expect(db.prepare("SELECT COUNT(*) AS count FROM orders").get()).toEqual({ count: 0 });
    db.prepare("UPDATE products SET active=1 WHERE id=?").run("red-velvet");
    const order = await create();
    expect(order.totalCents).toBe(4960);
  });

  it("registra duas recusas e aprova nova tentativa no mesmo pedido", async () => {
    const order = await create();
    for (const [card, outcome] of [
      ["4000000000009995", "INSUFFICIENT_FUNDS"],
      ["4000000000000002", "GENERIC_DECLINE"],
      ["4242424242424242", "APPROVED"],
    ]) {
      const response = await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`,
        payload: { publicToken: order.publicToken, testCardNumber: card } });
      expect(response.statusCode).toBe(200);
      expect(response.json().payment.outcome).toBe(outcome);
      expect(response.json().order.totalCents).toBe(order.totalCents);
    }
    const tracking = await app.inject(`/api/v1/orders/track/${order.publicToken}`);
    expect(tracking.json().order.paymentStatus).toBe("APPROVED");
    expect(tracking.json().order.paymentAttempts).toHaveLength(3);
    expect(JSON.stringify(tracking.json())).not.toContain("4242424242424242");
    expect((await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`,
      payload: { publicToken: order.publicToken, testCardNumber: "4242424242424242" } })).statusCode).toBe(409);
  });

  it("não registra cartão fora da lista nem aceita token incorreto", async () => {
    const order = await create();
    const invalidCard = await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`,
      payload: { publicToken: order.publicToken, testCardNumber: "4111111111111111" } });
    expect(invalidCard.statusCode).toBe(422);
    expect(invalidCard.json().error.code).toBe("UNSUPPORTED_TEST_CARD");
    const badToken = await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`,
      payload: { publicToken: "x".repeat(43), testCardNumber: "4242424242424242" } });
    expect(badToken.statusCode).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts").get()).toEqual({ count: 0 });
    expect((await app.inject(`/api/v1/orders/track/${"x".repeat(43)}`)).statusCode).toBe(404);
  });
});

describe("administração", () => {
  it("mostra pedidos pendentes ao oficial e apenas pagos ao convidado", async () => {
    const order = await create();
    const guest = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "senha-de-teste" } });
    const owner = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "engenheiro", password: "senha-oficial-de-teste" } });
    const guestHeaders = { cookie: String(guest.headers["set-cookie"]).split(";")[0]! };
    const ownerHeaders = { cookie: String(owner.headers["set-cookie"]).split(";")[0]! };
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/orders", headers: guestHeaders })).json().items).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/orders", headers: ownerHeaders })).json().items)
      .toMatchObject([{ id: order.id, paymentStatus: "PENDING" }]);
  });

  it("somente o acesso oficial apaga pedido, itens e tentativas", async () => {
    const order = await create();
    await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`, payload: {
      publicToken: order.publicToken, method: "CREDIT_CARD", testCardNumber: "4242424242424242",
    } });
    const url = `/api/v1/admin/orders/${order.id}`;
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(401);
    const guest = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "senha-de-teste" } });
    const guestHeaders = { cookie: String(guest.headers["set-cookie"]).split(";")[0]! };
    expect((await app.inject({ method: "DELETE", url, headers: guestHeaders })).statusCode).toBe(403);
    expect((await app.inject(`/api/v1/orders/track/${order.publicToken}`)).statusCode).toBe(200);
    const owner = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "engenheiro", password: "senha-oficial-de-teste" } });
    const ownerHeaders = { cookie: String(owner.headers["set-cookie"]).split(";")[0]! };
    expect((await app.inject({ method: "DELETE", url, headers: ownerHeaders })).statusCode).toBe(204);
    expect((await app.inject(`/api/v1/orders/track/${order.publicToken}`)).statusCode).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?").get(order.id)).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM payment_attempts WHERE order_id = ?").get(order.id)).toEqual({ count: 0 });
    expect((await app.inject({ method: "DELETE", url, headers: ownerHeaders })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: "/api/v1/admin/orders/invalido", headers: ownerHeaders })).statusCode).toBe(400);
  });

  it("somente o acesso oficial pode apagar uma avaliação", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/site-reviews", payload: {
      reviewerName: "Pessoa Teste", testDate: "2026-11-16", worked: "Vitrine", failed: "",
      notTested: "", suggestions: "", rating: 4, publicationConsent: true,
    } });
    const id = created.json().review.id;
    const url = `/api/v1/admin/site-reviews/${id}`;
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(401);
    const guestLogin = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "senha-de-teste" } });
    const guestHeaders = { cookie: String(guestLogin.headers["set-cookie"]).split(";")[0]! };
    expect(guestLogin.json().role).toBe("GUEST");
    expect((await app.inject({ method: "DELETE", url, headers: guestHeaders })).statusCode).toBe(403);
    expect((await app.inject(`/api/v1/site-reviews/${id}`)).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "engenheiro", password: "senha-de-teste" } })).statusCode).toBe(401);
    const ownerLogin = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "engenheiro", password: "senha-oficial-de-teste" } });
    const ownerHeaders = { cookie: String(ownerLogin.headers["set-cookie"]).split(";")[0]! };
    expect(ownerLogin.json().role).toBe("OWNER");
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/session", headers: ownerHeaders })).json().role).toBe("OWNER");
    expect((await app.inject({ method: "DELETE", url, headers: ownerHeaders })).statusCode).toBe(204);
    expect((await app.inject(`/api/v1/site-reviews/${id}`)).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url, headers: ownerHeaders })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: "/api/v1/admin/site-reviews/invalido", headers: ownerHeaders })).statusCode).toBe(400);
  });

  it("restaura sessão por cookie e expira após 10 minutos", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const login = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "senha-de-teste" } });
      const cookie = String(login.headers["set-cookie"]);
      expect(cookie).toContain("Max-Age=600");
      const cookieHeader = cookie.split(";")[0]!;
      const session = await app.inject({ method: "GET", url: "/api/v1/admin/session", headers: { cookie: cookieHeader } });
      expect(session.statusCode).toBe(200);
      expect(session.json()).toEqual({ authenticated: true, expiresAt: now + 600_000, role: "GUEST" });
      clock.mockReturnValue(now + 600_001);
      expect((await app.inject({ method: "GET", url: "/api/v1/admin/session", headers: { cookie: cookieHeader } })).statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url: "/api/v1/admin/orders", headers: { cookie: cookieHeader } })).statusCode).toBe(401);
    } finally { clock.mockRestore(); }
  });

  it("exige cookie, lista pedidos pagos, avança entrega e encerra sessão", async () => {
    const order = await create();
    expect((await app.inject("/api/v1/admin/orders")).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "errada" } })).statusCode).toBe(401);
    const login = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { username: "convidado", password: "senha-de-teste" } });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers["set-cookie"];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const cookieHeader = String(cookie).split(";")[0]!;
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/orders", headers: { cookie: cookieHeader } })).json().items).toHaveLength(0);
    await app.inject({ method: "POST", url: `/api/v1/orders/${order.id}/pay`,
      payload: { publicToken: order.publicToken, testCardNumber: "4242424242424242" } });
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/orders", headers: { cookie: cookieHeader } })).json().items).toHaveLength(1);
    const jump = await app.inject({ method: "PATCH", url: `/api/v1/admin/orders/${order.id}/status`,
      headers: { cookie: cookieHeader }, payload: { fulfillmentStatus: "DELIVERED" } });
    expect(jump.statusCode).toBe(409);
    for (const status of ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]) {
      const changed = await app.inject({ method: "PATCH", url: `/api/v1/admin/orders/${order.id}/status`,
        headers: { cookie: cookieHeader }, payload: { fulfillmentStatus: status } });
      expect(changed.statusCode).toBe(200);
      expect(changed.json().order.fulfillmentStatus).toBe(status);
    }
    expect((await app.inject(`/api/v1/orders/track/${order.publicToken}`)).json().order.fulfillmentStatus).toBe("DELIVERED");
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/logout", headers: { cookie: cookieHeader } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/orders", headers: { cookie: cookieHeader } })).statusCode).toBe(401);
  });

  it("só anuncia CORS para a origem configurada", async () => {
    const allowed = await app.inject({ method: "GET", url: "/api/v1/products", headers: { origin: "http://localhost:3000" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const denied = await app.inject({ method: "GET", url: "/api/v1/products", headers: { origin: "http://outra-origem.test" } });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    const preflight = await app.inject({ method: "OPTIONS", url: "/api/v1/admin/orders/id/status", headers: {
      origin: "http://localhost:3000",
      "access-control-request-method": "PATCH",
      "access-control-request-headers": "content-type",
    } });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-methods"]).toContain("PATCH");
  });
});
