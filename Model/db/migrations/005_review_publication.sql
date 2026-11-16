ALTER TABLE site_reviews ADD COLUMN publication_consent INTEGER NOT NULL DEFAULT 0 CHECK (publication_consent IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_site_reviews_public_created ON site_reviews(publication_consent, created_at DESC);
