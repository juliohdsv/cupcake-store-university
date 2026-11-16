import { resolve } from "node:path";
import next from "next";
import controller from "../Controller/dist/app.js";
import model from "@pit/model";

const { buildApp } = controller;
const { migrate, openDatabase, seedProductsIfEmpty } = model;

const adminPassword = process.env.ADMIN_PASSWORD;
const sessionKey = process.env.ADMIN_SESSION_KEY;
if (!adminPassword || !sessionKey || adminPassword.startsWith("CHANGE_ME") || sessionKey.startsWith("CHANGE_ME")) {
  console.error("Defina ADMIN_PASSWORD e ADMIN_SESSION_KEY seguros no ambiente.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT deve ser um número inteiro entre 1 e 65535.");
  process.exit(1);
}

const nextApp = next({ dev: false, dir: resolve("View"), hostname: host, port });
let db;
let app;

try {
  await nextApp.prepare();
  db = openDatabase();
  migrate(db);
  seedProductsIfEmpty(db);
  app = buildApp({
    db, adminPassword, sessionKey,
    ownerUsername: process.env.OFFICIAL_ADMIN_USERNAME,
    ownerPassword: process.env.OFFICIAL_ADMIN_PASSWORD,
    production: process.env.NODE_ENV === "production",
  });
  const handleNext = nextApp.getRequestHandler();

  app.route({ method: ["GET", "POST", "PUT", "PATCH", "DELETE"], url: "/*", handler: async (request, reply) => {
    if (request.url === "/api/v1" || request.url.startsWith("/api/v1/")) return reply.callNotFound();
    reply.hijack();
    await handleNext(request.raw, reply.raw);
  } });

  app.addHook("onClose", async () => {
    await nextApp.close();
    db.close();
  });
  await app.listen({ port, host });
  console.log(`Loja e API disponíveis na porta ${port}.`);
} catch (error) {
  console.error("Falha ao iniciar loja e API.", error);
  if (app) await app.close();
  else {
    if (db) db.close();
    await nextApp.close();
  }
  process.exitCode = 1;
}
