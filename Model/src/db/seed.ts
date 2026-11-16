import type { DatabaseConnection } from "./connection";

const products = [
  ["chocolate-belga", "Chocolate Belga", "Massa de cacau com cobertura cremosa de chocolate.", "Chocolate", 1290],
  ["baunilha-frutas-vermelhas", "Baunilha e Frutas Vermelhas", "Baunilha com geleia de frutas vermelhas.", "Frutas", 1390],
  ["red-velvet", "Red Velvet", "Massa aveludada e cobertura de cream cheese.", "Clássicos", 1490],
  ["limao-siciliano", "Limão Siciliano", "Massa cítrica e merengue suave.", "Frutas", 1290],
  ["cenoura-chocolate", "Cenoura com Chocolate", "Massa de cenoura e ganache de chocolate.", "Clássicos", 1190],
  ["doce-de-leite", "Doce de Leite", "Baunilha com recheio e cobertura de doce de leite.", "Clássicos", 1390],
  ["coco-queimado", "Coco Queimado", "Massa de coco e finalização de coco tostado.", "Clássicos", 1290],
  ["morango-creme", "Morango com Creme", "Massa de baunilha e creme com morango.", "Frutas", 1490],
  ["cafe-chocolate", "Café com Chocolate", "Massa de café e cobertura de chocolate.", "Chocolate", 1390],
  ["pistache", "Pistache", "Massa de pistache com cobertura cremosa.", "Especiais", 1690],
] as const;

export function seedProducts(db: DatabaseConnection): void {
  const insert = db.prepare(`
    INSERT INTO products (id, slug, name, description, category, image_path, price_cents, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name,
      description=excluded.description, category=excluded.category,
      image_path=excluded.image_path, price_cents=excluded.price_cents, active=excluded.active
  `);
  db.transaction(() => {
    for (const [slug, name, description, category, priceCents] of products) {
      insert.run(slug, slug, name, description, category, `/products/${slug}.jpg`, priceCents, "2026-01-01T00:00:00.000Z");
    }
  })();
}

export function seedProductsIfEmpty(db: DatabaseConnection): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  if (row.count === 0) seedProducts(db);
}
