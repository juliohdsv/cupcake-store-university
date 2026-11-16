import { z } from "zod";
import { orderSchema, productSchema, savedSiteReviewSchema } from "./schemas";
import type { CheckoutForm, PaymentMethod, SiteReviewForm } from "./schemas";

const apiBase = process.env.NEXT_PUBLIC_API_URL
  ?? (process.env.NODE_ENV === "development" ? "http://localhost:3333/api/v1" : "/api/v1");

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly details: Array<{ field: string; message: string }> = []) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, options: RequestInit = {}, admin = false): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options, cache: "no-store",
      credentials: admin ? "include" : "omit",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", "Não foi possível conectar à loja. Tente novamente.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z.object({ error: z.object({
      code: z.string(), message: z.string(),
      details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
    }) }).safeParse(data);
    if (parsed.success) throw new ApiError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
    throw new ApiError("HTTP_ERROR", "Não foi possível concluir a operação.");
  }
  return data;
}

export async function fetchProducts(filters: { q?: string; category?: string } = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (filters.q?.trim()) query.set("q", filters.q.trim());
  if (filters.category) query.set("category", filters.category);
  const suffix = query.size ? `?${query.toString()}` : "";
  return z.object({ items: z.array(productSchema) }).parse(await request(`/products${suffix}`, { signal })).items;
}

export async function fetchProduct(slug: string, signal?: AbortSignal) {
  return z.object({ product: productSchema }).parse(await request(`/products/${encodeURIComponent(slug)}`, { signal })).product;
}

export async function submitSiteReview(
  form: SiteReviewForm,
  screenshot?: { mimeType: string; dataBase64: string },
  signal?: AbortSignal,
) {
  return z.object({ review: z.object({ id: z.uuid(), createdAt: z.string() }) })
    .parse(await request("/site-reviews", {
      method: "POST", body: JSON.stringify({ ...form, ...(screenshot ? { screenshot } : {}) }), signal,
    })).review;
}

export async function fetchSiteReviews(admin = false, signal?: AbortSignal) {
  const path = admin ? "/admin/site-reviews" : "/site-reviews";
  return z.object({ items: z.array(savedSiteReviewSchema) }).parse(await request(path, { signal }, admin)).items;
}

export async function fetchSiteReview(id: string, admin = false, signal?: AbortSignal) {
  const path = admin ? `/admin/site-reviews/${encodeURIComponent(id)}` : `/site-reviews/${encodeURIComponent(id)}`;
  return z.object({ review: savedSiteReviewSchema }).parse(await request(path, { signal }, admin)).review;
}

export async function createOrder(items: Array<{ productId: string; quantity: number }>, form: CheckoutForm) {
  const body = {
    items,
    customer: { name: form.name, email: form.email, phone: form.phone },
    delivery: {
      zipCode: form.zipCode, street: form.street, number: form.number,
      complement: form.complement, neighborhood: form.neighborhood,
      city: form.city, state: form.state,
    },
  };
  return z.object({ order: orderSchema }).parse(await request("/orders", { method: "POST", body: JSON.stringify(body) })).order;
}

export async function payOrder(id: string, publicToken: string, method: PaymentMethod, testCardNumber?: string) {
  return z.object({ payment: z.object({ method: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]), outcome: z.enum(["APPROVED", "INSUFFICIENT_FUNDS", "GENERIC_DECLINE"]) }), order: orderSchema })
    .parse(await request(`/orders/${encodeURIComponent(id)}/pay`, {
      method: "POST", body: JSON.stringify({ publicToken, method, ...(testCardNumber ? { testCardNumber } : {}) }),
    }));
}

export async function fetchOrder(token: string, signal?: AbortSignal) {
  return z.object({ order: orderSchema }).parse(await request(`/orders/track/${encodeURIComponent(token)}`, { signal })).order;
}

const adminSessionSchema = z.object({ authenticated: z.literal(true), expiresAt: z.number().int(), role: z.enum(["GUEST", "OWNER"]) });
export async function adminLogin(username: string, password: string) {
  return adminSessionSchema
    .parse(await request("/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }, true));
}
export async function fetchAdminSession(signal?: AbortSignal) {
  return adminSessionSchema
    .parse(await request("/admin/session", { signal }, true));
}
export async function deleteAdminReview(id: string) {
  return request(`/admin/site-reviews/${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}
export async function adminLogout() {
  return request("/admin/logout", { method: "POST" }, true);
}
export async function fetchAdminOrders(signal?: AbortSignal) {
  return z.object({ items: z.array(orderSchema) }).parse(await request("/admin/orders", { signal }, true)).items;
}
export async function deleteAdminOrder(id: string) {
  return request(`/admin/orders/${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}
export async function advanceOrder(id: string, fulfillmentStatus: "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED") {
  return z.object({ order: orderSchema }).parse(await request(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: JSON.stringify({ fulfillmentStatus }),
  }, true)).order;
}
