export type PaymentStatus = "PENDING" | "DECLINED" | "APPROVED";
export type FulfillmentStatus =
  | "AWAITING_PAYMENT"
  | "RECEIVED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";
export type PaymentOutcome = "APPROVED" | "INSUFFICIENT_FUNDS" | "GENERIC_DECLINE";
export type PaymentMethod = "CREDIT_CARD" | "PIX" | "BOLETO";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  imagePath: string;
  priceCents: number;
  active: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface PaymentAttempt {
  id: string;
  method: PaymentMethod;
  cardLast4: string;
  outcome: PaymentOutcome;
  createdAt: string;
}

export interface Order {
  id: string;
  publicToken: string;
  customer: { name: string; email: string; phone: string };
  delivery: {
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
  paymentAttempts: PaymentAttempt[];
}

export interface CreateOrderInput {
  items: Array<{ productId: string; quantity: number }>;
  customer: Order["customer"];
  delivery: Order["delivery"];
}
