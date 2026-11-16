import { z } from "zod";

export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  imagePath: z.string(),
  priceCents: z.number().int(),
  active: z.boolean(),
});
export type Product = z.infer<typeof productSchema>;

export const orderSchema = z.object({
  id: z.string(),
  publicToken: z.string(),
  customerName: z.string(),
  delivery: z.object({
    zipCode: z.string(),
    street: z.string(),
    number: z.string(),
    complement: z.string(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  subtotalCents: z.number().int(),
  shippingCents: z.number().int(),
  totalCents: z.number().int(),
  paymentStatus: z.enum(["PENDING", "DECLINED", "APPROVED"]),
  fulfillmentStatus: z.enum([
    "AWAITING_PAYMENT",
    "RECEIVED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ]),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      productName: z.string(),
      unitPriceCents: z.number().int(),
      quantity: z.number().int(),
      lineTotalCents: z.number().int(),
    }),
  ),
  paymentAttempts: z.array(
    z.object({
      id: z.string(),
      method: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]),
      cardLast4: z.string(),
      outcome: z.enum(["APPROVED", "INSUFFICIENT_FUNDS", "GENERIC_DECLINE"]),
      createdAt: z.string(),
    }),
  ),
});
export type Order = z.infer<typeof orderSchema>;
export type PaymentMethod = Order["paymentAttempts"][number]["method"];

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.email("Informe um e-mail válido."),
  phone: z.string().regex(/^\d{10,11}$/, "Use DDD e 10 ou 11 dígitos."),
  zipCode: z.string().regex(/^\d{8}$/, "Informe um CEP com 8 dígitos."),
  street: z.string().trim().min(2, "Informe a rua."),
  number: z.string().trim().min(1, "Informe o número."),
  complement: z.string().trim(),
  neighborhood: z.string().trim().min(2, "Informe o bairro."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z
    .string()
    .regex(/^[A-Z]{2}$/, "Informe a UF com duas letras maiúsculas."),
});
export type CheckoutForm = z.infer<typeof checkoutSchema>;

export const siteReviewSchema = z.object({
  reviewerName: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(100, "Use até 100 caracteres."),
  testDate: z.iso.date("Informe uma data válida."),
  worked: z.string().trim().max(2000, "Use até 2.000 caracteres."),
  failed: z.string().trim().max(2000, "Use até 2.000 caracteres."),
  notTested: z.string().trim().max(2000, "Use até 2.000 caracteres."),
  suggestions: z.string().trim().max(2000, "Use até 2.000 caracteres."),
  rating: z.number().int().min(1, "Selecione uma nota.").max(5),
  publicationConsent: z.boolean(),
});
export type SiteReviewForm = z.infer<typeof siteReviewSchema>;

export const savedSiteReviewSchema = siteReviewSchema.extend({
  id: z.uuid(),
  screenshotDataUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type SavedSiteReview = z.infer<typeof savedSiteReviewSchema>;
