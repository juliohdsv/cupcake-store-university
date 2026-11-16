import type { DatabaseConnection } from "../db/connection";
import type { Product } from "../types";

interface ProductRow extends Omit<Product, "active"> { active: number }

function mapProduct(row: ProductRow): Product {
  return { ...row, active: row.active === 1 };
}

const selectProduct = `SELECT id, slug, name, description, category, image_path AS imagePath,
  price_cents AS priceCents, active FROM products`;

export function listProducts(db: DatabaseConnection, filters: { q?: string; category?: string } = {}): Product[] {
  const clauses = ["active = 1"];
  const parameters: string[] = [];
  if (filters.q) {
    clauses.push("name LIKE ? ESCAPE '\\'");
    parameters.push(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (filters.category) {
    clauses.push("category = ?");
    parameters.push(filters.category);
  }
  const rows = db.prepare(`${selectProduct} WHERE ${clauses.join(" AND ")} ORDER BY name`).all(...parameters) as ProductRow[];
  return rows.map(mapProduct);
}

export function getProductBySlug(db: DatabaseConnection, slug: string): Product | null {
  const row = db.prepare(`${selectProduct} WHERE slug = ? AND active = 1`).get(slug) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

export function getProductById(db: DatabaseConnection, id: string): Product | null {
  const row = db.prepare(`${selectProduct} WHERE id = ? AND active = 1`).get(id) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}
