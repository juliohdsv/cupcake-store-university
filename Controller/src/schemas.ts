import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const productQuerySchema = z.object({ q: text(1, 80).optional(), category: text(1, 60).optional() }).strict();
export const productSlugSchema = z.object({ slug: text(1, 100) }).strict();
export const orderIdSchema = z.object({ id: z.uuid() }).strict();
export const trackSchema = z.object({ publicToken: text(20, 100) }).strict();

export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: text(1, 100), quantity: z.number().int().min(1).max(20),
  }).strict()).min(1).max(50),
  customer: z.object({
    name: text(2, 100), email: z.email().max(160),
    phone: z.string().regex(/^\d{10,11}$/, "Informe telefone com DDD e 10 ou 11 dígitos."),
  }).strict(),
  delivery: z.object({
    zipCode: z.string().regex(/^\d{8}$/, "Informe um CEP com 8 dígitos."),
    street: text(2, 120), number: text(1, 20), complement: z.string().trim().max(100),
    neighborhood: text(2, 100), city: text(2, 100),
    state: z.string().regex(/^[A-Z]{2}$/, "Informe a UF com duas letras maiúsculas."),
  }).strict(),
}).strict();
export const payOrderSchema = z.object({
  publicToken: text(20, 100),
  method: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]).default("CREDIT_CARD"),
  testCardNumber: z.string().min(16).max(30).optional(),
}).strict().superRefine((input, context) => {
  if (input.method === "CREDIT_CARD" && !input.testCardNumber) {
    context.addIssue({ code: "custom", path: ["testCardNumber"], message: "Escolha um cartão de demonstração." });
  }
  if (input.method !== "CREDIT_CARD" && input.testCardNumber) {
    context.addIssue({ code: "custom", path: ["testCardNumber"], message: "Pix e boleto não usam cartão." });
  }
});
export const loginSchema = z.object({ username: text(2, 100), password: z.string().min(1).max(200) }).strict();
export const statusSchema = z.object({ fulfillmentStatus: z.enum(["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]) }).strict();

export const orderAmountsSchema = z.object({
  subtotalCents: z.number().int().nonnegative(),
  shippingCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
}).passthrough();

const screenshotSchema = z.object({
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  dataBase64: z.string().min(1).max(4_194_304).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, "Imagem inválida."),
}).strict().superRefine(({ mimeType, dataBase64 }, context) => {
  const bytes = Buffer.from(dataBase64, "base64");
  const valid = bytes.length > 0 && bytes.length <= 3 * 1024 * 1024 && (
    (mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (mimeType === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
  );
  if (!valid) context.addIssue({ code: "custom", message: "Envie uma imagem PNG, JPEG ou WebP de até 3 MB." });
}).transform(({ mimeType, dataBase64 }) => ({ mimeType, data: Buffer.from(dataBase64, "base64") }));

export const siteReviewSchema = z.object({
  reviewerName: text(2, 100),
  testDate: z.iso.date(),
  worked: z.string().trim().max(2000).default(""),
  failed: z.string().trim().max(2000).default(""),
  notTested: z.string().trim().max(2000).default(""),
  suggestions: z.string().trim().max(2000).default(""),
  rating: z.number().int().min(1).max(5),
  publicationConsent: z.boolean().default(false),
  screenshot: screenshotSchema.optional(),
}).strict();
