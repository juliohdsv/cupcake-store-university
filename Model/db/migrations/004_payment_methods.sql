-- Preserva tentativas antigas como cartão de crédito.
ALTER TABLE payment_attempts ADD COLUMN method TEXT NOT NULL DEFAULT 'CREDIT_CARD'
  CHECK (method IN ('CREDIT_CARD', 'PIX', 'BOLETO'));
