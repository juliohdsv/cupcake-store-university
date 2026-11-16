import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  advanceFulfillment, createOrder, createSiteReview, deleteOrder, deleteSiteReview, getOrderByToken, getProductBySlug,
  getSiteReview, listOrders, listPaidOrders, listProducts, listSiteReviews, payOrderByMethod,
} from "@pit/model";
import type { DatabaseConnection, Order } from "@pit/model";
import {
  createOrderSchema, loginSchema, orderAmountsSchema, orderIdSchema, payOrderSchema,
  productQuerySchema, productSlugSchema, siteReviewSchema, statusSchema, trackSchema,
} from "./schemas";
import type { AdminSessions } from "./sessions";
import { ADMIN_SESSION_SECONDS } from "./sessions";

function publicOrder(order: Order) {
  const response = {
    id: order.id, publicToken: order.publicToken, customerName: order.customer.name,
    delivery: order.delivery, subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents, totalCents: order.totalCents,
    paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus,
    createdAt: order.createdAt, paidAt: order.paidAt,
    items: order.items, paymentAttempts: order.paymentAttempts,
  };
  orderAmountsSchema.parse(response);
  return response;
}

export function registerRoutes(app: FastifyInstance, db: DatabaseConnection, sessions: AdminSessions, production: boolean): void {
  const cookieOptions = { path: "/api/v1/admin", httpOnly: true, sameSite: "lax" as const, secure: production };
  app.get("/api/v1/health", async () => ({ status: "ok" }));

  app.post("/api/v1/site-reviews", { bodyLimit: 4_500_000 }, async (request, reply) => {
    const input = siteReviewSchema.parse(request.body);
    return reply.status(201).send({ review: createSiteReview(db, input) });
  });
  app.get("/api/v1/site-reviews", async () => ({ items: listSiteReviews(db, true) }));
  app.get("/api/v1/site-reviews/:id", async (request, reply) => {
    const { id } = orderIdSchema.parse(request.params);
    const review = getSiteReview(db, id, true);
    if (!review) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Avaliação não encontrada." } });
    return { review };
  });

  app.get("/api/v1/products", async (request) => ({
    items: listProducts(db, productQuerySchema.parse(request.query)),
  }));
  app.get("/api/v1/products/:slug", async (request, reply) => {
    const { slug } = productSlugSchema.parse(request.params);
    const product = getProductBySlug(db, slug);
    if (!product) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cupcake não encontrado." } });
    return { product };
  });
  app.post("/api/v1/orders", async (request, reply) => {
    const input = createOrderSchema.parse(request.body);
    return reply.status(201).send({ order: publicOrder(createOrder(db, input)) });
  });
  app.post("/api/v1/orders/:id/pay", async (request) => {
    const { id } = orderIdSchema.parse(request.params);
    const { publicToken, method, testCardNumber } = payOrderSchema.parse(request.body);
    const result = payOrderByMethod(db, id, publicToken, method, testCardNumber);
    return { payment: { method, outcome: result.outcome }, order: publicOrder(result.order) };
  });
  app.get("/api/v1/orders/track/:publicToken", async (request, reply) => {
    const { publicToken } = trackSchema.parse(request.params);
    const order = getOrderByToken(db, publicToken);
    if (!order) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Pedido não encontrado." } });
    return { order: publicOrder(order) };
  });

  app.post("/api/v1/admin/login", async (request, reply) => {
    const { username, password } = loginSchema.parse(request.body);
    const role = sessions.authenticate(username, password);
    if (!role) return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." } });
    const token = sessions.create(role);
    reply.setCookie("admin_session", token, { ...cookieOptions, maxAge: ADMIN_SESSION_SECONDS });
    return { authenticated: true, expiresAt: sessions.get(token)!.expiresAt, role };
  });
  app.get("/api/v1/admin/session", async (request, reply) => {
    const session = sessions.get(request.cookies.admin_session);
    if (!session) return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sessão expirada. Informe a senha novamente." } });
    return { authenticated: true, expiresAt: session.expiresAt, role: session.role };
  });
  app.post("/api/v1/admin/logout", async (request, reply) => {
    sessions.revoke(request.cookies.admin_session);
    reply.clearCookie("admin_session", cookieOptions);
    return { authenticated: false };
  });

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!sessions.verify(request.cookies.admin_session)) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Acesso administrativo necessário." } });
    }
  };
  const requireOwner = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = sessions.get(request.cookies.admin_session);
    if (!session) return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Acesso administrativo necessário." } });
    if (session.role !== "OWNER") return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Somente o administrador oficial pode excluir registros." } });
  };
  app.get("/api/v1/admin/orders", { preHandler: requireAdmin }, async (request) => ({
    items: (sessions.get(request.cookies.admin_session)?.role === "OWNER" ? listOrders(db) : listPaidOrders(db)).map(publicOrder),
  }));
  app.get("/api/v1/admin/site-reviews", { preHandler: requireAdmin }, async () => ({ items: listSiteReviews(db, false) }));
  app.get("/api/v1/admin/site-reviews/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = orderIdSchema.parse(request.params);
    const review = getSiteReview(db, id, false);
    if (!review) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Avaliação não encontrada." } });
    return { review };
  });
  app.delete("/api/v1/admin/site-reviews/:id", { preHandler: requireOwner }, async (request, reply) => {
    const { id } = orderIdSchema.parse(request.params);
    if (!deleteSiteReview(db, id)) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Avaliação não encontrada." } });
    return reply.status(204).send();
  });
  app.patch("/api/v1/admin/orders/:id/status", { preHandler: requireAdmin }, async (request) => {
    const { id } = orderIdSchema.parse(request.params);
    const { fulfillmentStatus } = statusSchema.parse(request.body);
    return { order: publicOrder(advanceFulfillment(db, id, fulfillmentStatus)) };
  });
  app.delete("/api/v1/admin/orders/:id", { preHandler: requireOwner }, async (request, reply) => {
    const { id } = orderIdSchema.parse(request.params);
    if (!deleteOrder(db, id)) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Pedido não encontrado." } });
    return reply.status(204).send();
  });
}
