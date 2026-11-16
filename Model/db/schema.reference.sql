-- Esquema de referência acadêmica: implementar migrações idempotentes separadas.
-- Não executar automaticamente em produção sem um fluxo de migração.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  image_path TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(active, category);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  public_token TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  street TEXT NOT NULL,
  street_number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents = subtotal_cents + shipping_cents),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'DECLINED', 'APPROVED')),
  fulfillment_status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT'
    CHECK (fulfillment_status IN ('AWAITING_PAYMENT','RECEIVED','PREPARING','OUT_FOR_DELIVERY','DELIVERED')),
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status, fulfillment_status);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents = unit_price_cents * quantity)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  card_last4 TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'CREDIT_CARD' CHECK (method IN ('CREDIT_CARD','PIX','BOLETO')),
  outcome TEXT NOT NULL CHECK (outcome IN ('APPROVED','INSUFFICIENT_FUNDS','GENERIC_DECLINE')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id);
CREATE TABLE IF NOT EXISTS site_reviews (
  id TEXT PRIMARY KEY,
  reviewer_name TEXT NOT NULL CHECK (length(reviewer_name) BETWEEN 2 AND 100),
  test_date TEXT NOT NULL,
  worked TEXT NOT NULL DEFAULT '',
  failed TEXT NOT NULL DEFAULT '',
  not_tested TEXT NOT NULL DEFAULT '',
  suggestions TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  screenshot_mime TEXT CHECK (screenshot_mime IN ('image/png', 'image/jpeg', 'image/webp')),
  screenshot_data BLOB,
  created_at TEXT NOT NULL,
  publication_consent INTEGER NOT NULL DEFAULT 0 CHECK (publication_consent IN (0, 1)),
  CHECK ((screenshot_mime IS NULL AND screenshot_data IS NULL) OR
    (screenshot_mime IS NOT NULL AND screenshot_data IS NOT NULL AND length(screenshot_data) BETWEEN 1 AND 3145728))
);
CREATE INDEX IF NOT EXISTS idx_site_reviews_created_at ON site_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_site_reviews_public_created ON site_reviews(publication_consent, created_at DESC);
