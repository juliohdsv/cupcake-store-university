import { openDatabase } from "@pit/model";
import { buildApp } from "./app";

const adminPassword = process.env.ADMIN_PASSWORD;
const sessionKey = process.env.ADMIN_SESSION_KEY;
const ownerUsername = process.env.OFFICIAL_ADMIN_USERNAME;
const ownerPassword = process.env.OFFICIAL_ADMIN_PASSWORD;
if (!adminPassword || !sessionKey || adminPassword.startsWith("CHANGE_ME") || sessionKey.startsWith("CHANGE_ME")) {
  console.error("Defina ADMIN_PASSWORD e ADMIN_SESSION_KEY seguros no arquivo .env.");
  process.exit(1);
}

const db = openDatabase();
const app = buildApp({
  db, adminPassword, sessionKey, ownerUsername, ownerPassword,
  webOrigin: process.env.WEB_ORIGIN,
  production: process.env.NODE_ENV === "production",
});
app.addHook("onClose", async () => db.close());
const port = Number(process.env.API_PORT ?? 3333);
const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
app.listen({ port, host }).catch((error: unknown) => {
  console.error("Falha ao iniciar a API.", error);
  process.exitCode = 1;
  void app.close();
});
