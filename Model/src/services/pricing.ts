import { DomainError } from "../errors";

export const SHIPPING_CENTS = 890;
export const MAX_QUANTITY = 20;

export function calculateLineTotal(priceCents: number, quantity: number): number {
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new DomainError("INVALID_ITEMS", "Preço ou quantidade inválida.");
  }
  const total = priceCents * quantity;
  if (!Number.isSafeInteger(total)) throw new DomainError("INVALID_ITEMS", "Valor do pedido excede o limite permitido.");
  return total;
}

export function calculateTotals(lines: Array<{ priceCents: number; quantity: number }>) {
  if (lines.length === 0) throw new DomainError("INVALID_ITEMS", "Adicione ao menos um cupcake.");
  const subtotalCents = lines.reduce((sum, line) => sum + calculateLineTotal(line.priceCents, line.quantity), 0);
  const totalCents = subtotalCents + SHIPPING_CENTS;
  if (!Number.isSafeInteger(totalCents)) throw new DomainError("INVALID_ITEMS", "Valor do pedido excede o limite permitido.");
  return { subtotalCents, shippingCents: SHIPPING_CENTS, totalCents };
}
