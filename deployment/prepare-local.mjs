import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import model from "@pit/model";

const { migrate, openDatabase, seedProductsIfEmpty } = model;
const envPath = resolve(".env");
const existed = existsSync(envPath);
let contents = existed
  ? readFileSync(envPath, "utf8")
  : "# Configuração local gerada automaticamente. Não envie este arquivo ao Git.\nNODE_ENV=development\nAPI_PORT=3333\nWEB_ORIGIN=http://localhost:3000\nDATABASE_PATH=./Model/data/cupcakes.sqlite\n";

function ensureSecret(name, value) {
  const assignment = new RegExp(`^${name}=(.*)$`, "m");
  const match = contents.match(assignment);
  if (!match) {
    contents = `${contents.trimEnd()}\n${name}=${value}\n`;
    return true;
  }
  if (match[1]?.trim() && !match[1].trim().startsWith("CHANGE_ME")) return false;
  contents = contents.replace(assignment, `${name}=${value}`);
  return true;
}

const passwordCreated = ensureSecret("ADMIN_PASSWORD", "12345678");
const hintCreated = ensureSecret("NEXT_PUBLIC_DEMO_ADMIN_PASSWORD", "12345678");
const sessionCreated = ensureSecret("ADMIN_SESSION_KEY", randomBytes(32).toString("base64url"));
if (!existed || passwordCreated || hintCreated || sessionCreated) writeFileSync(envPath, contents, { mode: 0o600 });
chmodSync(envPath, 0o600);

const db = openDatabase();
try {
  migrate(db);
  seedProductsIfEmpty(db);
} finally {
  db.close();
}

if (!existed || passwordCreated) console.log("Configuração local pronta. Senha de demonstração do painel: 12345678.");
console.log("SQLite migrado; catálogo inicial disponível.");
