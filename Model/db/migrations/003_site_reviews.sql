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
  CHECK ((screenshot_mime IS NULL AND screenshot_data IS NULL) OR
    (screenshot_mime IS NOT NULL AND screenshot_data IS NOT NULL AND length(screenshot_data) BETWEEN 1 AND 3145728))
);
CREATE INDEX IF NOT EXISTS idx_site_reviews_created_at ON site_reviews(created_at);
