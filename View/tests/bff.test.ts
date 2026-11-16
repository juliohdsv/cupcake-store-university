import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/v1/[...path]/route";

const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("BFF da loja", () => {
  it("encaminha login e cookie pela API interna", async () => {
    vi.stubEnv("API_INTERNAL_ORIGIN", "http://api:3021");
    const upstream = vi.fn(async () => new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": "admin_session=token; Path=/api/v1/admin; HttpOnly" },
    }));
    vi.stubGlobal("fetch", upstream);

    const response = await POST(new Request("https://loja.exemplo/api/v1/admin/login", {
      method: "POST", headers: { "content-type": "application/json", origin: "https://loja.exemplo" },
      body: JSON.stringify({ username: "convidado", password: "senha-de-teste" }),
    }), context("admin", "login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("admin_session=token");
    expect(upstream).toHaveBeenCalledOnce();
    const [url, options] = upstream.mock.calls[0]!;
    expect(String(url)).toBe("http://api:3021/api/v1/admin/login");
    expect(options.method).toBe("POST");
  });

  it("encaminha a sessão administrativa com cookie", async () => {
    vi.stubEnv("API_INTERNAL_ORIGIN", "http://api:3021");
    const upstream = vi.fn(async () => Response.json({ authenticated: true, role: "GUEST", expiresAt: 1 }));
    vi.stubGlobal("fetch", upstream);

    const response = await GET(new Request("https://loja.exemplo/api/v1/admin/session", {
      headers: { cookie: "admin_session=token" },
    }), context("admin", "session"));

    expect(response.status).toBe(200);
    expect(upstream.mock.calls[0]![1].headers.get("cookie")).toBe("admin_session=token");
  });

  it("aceita a origem pública quando Next usa localhost internamente", async () => {
    vi.stubEnv("API_INTERNAL_ORIGIN", "http://api:3021");
    const upstream = vi.fn(async () => Response.json({ authenticated: true }));
    vi.stubGlobal("fetch", upstream);

    const response = await POST(new Request("http://localhost:3020/api/v1/admin/login", {
      method: "POST",
      headers: { host: "127.0.0.1:3020", origin: "http://127.0.0.1:3020", "content-type": "application/json" },
      body: "{}",
    }), context("admin", "login"));

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("não encaminha rotas internas ou origens externas", async () => {
    vi.stubEnv("API_INTERNAL_ORIGIN", "http://api:3021");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const health = await GET(new Request("https://loja.exemplo/api/v1/health"), context("health"));
    const foreign = await POST(new Request("https://loja.exemplo/api/v1/admin/login", {
      method: "POST", headers: { origin: "https://outro.exemplo", "content-type": "application/json" },
      body: "{}",
    }), context("admin", "login"));

    expect(health.status).toBe(404);
    expect(foreign.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("limita o corpo antes de chamar a API", async () => {
    vi.stubEnv("API_INTERNAL_ORIGIN", "http://api:3021");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(new Request("https://loja.exemplo/api/v1/site-reviews", {
      method: "POST", headers: { "content-type": "application/json" },
      body: "x".repeat(4_500_001),
    }), context("site-reviews"));

    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});
