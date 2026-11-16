import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_SECONDS = 10 * 60;
const lifetimeMs = ADMIN_SESSION_SECONDS * 1000;
export type AdminRole = "GUEST" | "OWNER";
interface Session { expiresAt: number; role: AdminRole }

export function createAdminSessions(password: string, secret: string, ownerUsername?: string, ownerPassword?: string) {
  const active = new Map<string, Session>();
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const matches = (candidate: string, expected: string) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  return {
    authenticate(username: string, candidate: string): AdminRole | null {
      if (username === "convidado" && matches(candidate, password)) return "GUEST";
      if (ownerUsername && ownerPassword && username === ownerUsername && matches(candidate, ownerPassword)) return "OWNER";
      return null;
    },
    create(role: AdminRole): string {
      const token = randomBytes(32).toString("base64url");
      active.set(digest(token), { expiresAt: Date.now() + lifetimeMs, role });
      return token;
    },
    verify(token: string | undefined): boolean {
      return this.get(token) !== null;
    },
    get(token: string | undefined): Session | null {
      if (!token) return null;
      const key = digest(token);
      const session = active.get(key);
      if (!session) return null;
      if (session.expiresAt <= Date.now()) { active.delete(key); return null; }
      return session;
    },
    revoke(token: string | undefined): void {
      if (token) active.delete(digest(token));
    },
  };
}

export type AdminSessions = ReturnType<typeof createAdminSessions>;
