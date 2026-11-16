import { randomUUID } from "node:crypto";
import type { DatabaseConnection } from "../db/connection";

export interface SiteReviewInput {
  reviewerName: string;
  testDate: string;
  worked: string;
  failed: string;
  notTested: string;
  suggestions: string;
  rating: number;
  publicationConsent: boolean;
  screenshot?: { mimeType: "image/png" | "image/jpeg" | "image/webp"; data: Buffer };
}

export interface SiteReview {
  id: string;
  reviewerName: string;
  testDate: string;
  worked: string;
  failed: string;
  notTested: string;
  suggestions: string;
  rating: number;
  publicationConsent: boolean;
  screenshotDataUrl: string | null;
  createdAt: string;
}

interface ReviewRow {
  id: string; reviewer_name: string; test_date: string; worked: string; failed: string;
  not_tested: string; suggestions: string; rating: number; publication_consent: number;
  screenshot_mime: string | null; screenshot_data: Buffer | null; created_at: string;
}

function fromRow(row: ReviewRow): SiteReview {
  return {
    id: row.id, reviewerName: row.reviewer_name, testDate: row.test_date,
    worked: row.worked, failed: row.failed, notTested: row.not_tested,
    suggestions: row.suggestions, rating: row.rating,
    publicationConsent: row.publication_consent === 1,
    screenshotDataUrl: row.screenshot_mime && row.screenshot_data
      ? `data:${row.screenshot_mime};base64,${row.screenshot_data.toString("base64")}` : null,
    createdAt: row.created_at,
  };
}

export function createSiteReview(db: DatabaseConnection, input: SiteReviewInput): { id: string; createdAt: string } {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO site_reviews
    (id, reviewer_name, test_date, worked, failed, not_tested, suggestions, rating, screenshot_mime, screenshot_data, created_at, publication_consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, input.reviewerName, input.testDate, input.worked, input.failed, input.notTested,
    input.suggestions, input.rating, input.screenshot?.mimeType ?? null,
    input.screenshot?.data ?? null, createdAt, input.publicationConsent ? 1 : 0,
  );
  return { id, createdAt };
}

export function listSiteReviews(db: DatabaseConnection, publicOnly: boolean): SiteReview[] {
  const where = publicOnly ? "WHERE publication_consent = 1" : "";
  return (db.prepare(`SELECT * FROM site_reviews ${where} ORDER BY created_at DESC, id DESC`).all() as ReviewRow[]).map(fromRow);
}

export function getSiteReview(db: DatabaseConnection, id: string, publicOnly: boolean): SiteReview | null {
  const where = publicOnly ? "AND publication_consent = 1" : "";
  const row = db.prepare(`SELECT * FROM site_reviews WHERE id = ? ${where}`).get(id) as ReviewRow | undefined;
  return row ? fromRow(row) : null;
}

export function deleteSiteReview(db: DatabaseConnection, id: string): boolean {
  return db.prepare("DELETE FROM site_reviews WHERE id = ?").run(id).changes > 0;
}
