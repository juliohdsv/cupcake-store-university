import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { DatabaseConnection } from "@pit/model";
import { DomainError } from "@pit/model";
import { ZodError } from "zod";
import { registerRoutes } from "./routes";
import { createAdminSessions } from "./sessions";

export interface AppOptions {
  db: DatabaseConnection;
  adminPassword: string;
  ownerUsername?: string;
  ownerPassword?: string;
  sessionKey: string;
  webOrigin?: string;
  production?: boolean;
}

const domainStatus: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  TOKEN_MISMATCH: 404,
  ORDER_ALREADY_PAID: 409,
  INVALID_STATUS_TRANSITION: 409,
  INVALID_ITEMS: 422,
  PRODUCT_UNAVAILABLE: 422,
  UNSUPPORTED_TEST_CARD: 422,
  INVALID_PAYMENT_METHOD: 422,
};

export function buildApp(options: AppOptions) {
  const app = Fastify({ logger: false });
  const sessions = createAdminSessions(options.adminPassword, options.sessionKey, options.ownerUsername, options.ownerPassword);
  const webOrigin = options.webOrigin ?? "http://localhost:3000";
  app.register(cors, {
    origin: (origin, done) => done(null, !origin || origin === webOrigin),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  app.register(cookie);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ error: {
      code: "VALIDATION_ERROR", message: "Revise os campos informados.",
      details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    } });
    if (error instanceof Error && "statusCode" in error && error.statusCode === 400) return reply.status(400).send({ error: {
      code: "VALIDATION_ERROR", message: "Revise o JSON enviado.",
    } });
    if (error instanceof Error && "statusCode" in error && error.statusCode === 413) return reply.status(413).send({ error: {
      code: "FILE_TOO_LARGE", message: "A captura de tela deve ter até 3 MB.",
    } });
    if (error instanceof DomainError) return reply.status(domainStatus[error.code] ?? 422).send({
      error: { code: error.code, message: error.message },
    });
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação." } });
  });
  app.setNotFoundHandler((_request, reply) => reply.status(404).send({
    error: { code: "NOT_FOUND", message: "Recurso não encontrado." },
  }));

  registerRoutes(app, options.db, sessions, options.production ?? false);
  return app;
}
