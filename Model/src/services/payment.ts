import { DomainError } from "../errors";
import type { PaymentOutcome } from "../types";

const cards: Record<string, PaymentOutcome> = {
  "4242424242424242": "APPROVED",
  "4000000000009995": "INSUFFICIENT_FUNDS",
  "4000000000000002": "GENERIC_DECLINE",
};

export function simulatePayment(testCardNumber: string): PaymentOutcome {
  const outcome = cards[testCardNumber.replace(/ /g, "")];
  if (!outcome) throw new DomainError("UNSUPPORTED_TEST_CARD", "Use um dos três cartões de demonstração.");
  return outcome;
}

export function lastFourDigits(testCardNumber: string): string {
  return testCardNumber.replace(/ /g, "").slice(-4);
}
