export function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export const fulfillmentLabels = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  RECEIVED: "Pedido recebido",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
} as const;

export const paymentLabels = {
  PENDING: "Pagamento pendente",
  DECLINED: "Pagamento recusado",
  APPROVED: "Pagamento aprovado",
} as const;

export const paymentMethodLabels = {
  CREDIT_CARD: "Cartão de crédito",
  PIX: "Pix",
  BOLETO: "Boleto",
} as const;
