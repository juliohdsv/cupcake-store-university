export type DomainErrorCode =
  | "INVALID_ITEMS"
  | "PRODUCT_UNAVAILABLE"
  | "ORDER_NOT_FOUND"
  | "TOKEN_MISMATCH"
  | "ORDER_ALREADY_PAID"
  | "UNSUPPORTED_TEST_CARD"
  | "INVALID_PAYMENT_METHOD"
  | "INVALID_STATUS_TRANSITION";

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
  }
}
