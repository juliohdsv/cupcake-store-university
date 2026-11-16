import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseConnection } from "./connection";

const migrationsPath = resolve(__dirname, "../../db/migrations");

export function migrate(db: DatabaseConnection): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?");
  const record = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const name of readdirSync(migrationsPath).filter((file) => file.endsWith(".sql")).sort()) {
    if (applied.get(name)) continue;
    const sql = readFileSync(resolve(migrationsPath, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(name, new Date().toISOString());
    })();
  }
}
