import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DatabaseConnection = Database.Database;

const projectRoot = resolve(__dirname, "../../..");

export function openDatabase(databasePath = process.env.DATABASE_PATH ?? "Model/data/cupcakes.sqlite"): DatabaseConnection {
  const filename = databasePath === ":memory:" ? databasePath : resolve(projectRoot, databasePath);
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  return db;
}
