type RouteContext = { params: Promise<{ path: string[] }> };

const allowedRoutes: Record<string, RegExp[]> = {
  GET: [
    /^products(?:\/[a-z0-9-]+)?$/,
    /^site-reviews(?:\/[a-f0-9-]+)?$/,
    /^orders\/track\/[A-Za-z0-9_-]+$/,
    /^admin\/session$/,
    /^admin\/orders$/,
    /^admin\/site-reviews(?:\/[a-f0-9-]+)?$/,
  ],
  POST: [
    /^site-reviews$/,
    /^orders$/,
    /^orders\/[a-f0-9-]+\/pay$/,
    /^admin\/(?:login|logout)$/,
  ],
  PATCH: [/^admin\/orders\/[a-f0-9-]+\/status$/],
  DELETE: [
    /^admin\/orders\/[a-f0-9-]+$/,
    /^admin\/site-reviews\/[a-f0-9-]+$/,
  ],
};

function error(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function forward(request: Request, context: RouteContext): Promise<Response> {
  const method = request.method;
  const { path } = await context.params;
  const route = path.join("/");
  if (!allowedRoutes[method]?.some((pattern) => pattern.test(route))) {
    return error(404, "NOT_FOUND", "Recurso não encontrado.");
  }

  const origin = request.headers.get("origin");
  const publicHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host)
    .split(",")[0]!.trim();
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return error(403, "FORBIDDEN", "Origem da requisição não autorizada.");
    }
    if (originHost !== publicHost) {
      return error(403, "FORBIDDEN", "Origem da requisição não autorizada.");
    }
  }

  const internalOrigin = process.env.API_INTERNAL_ORIGIN;
  if (!internalOrigin) {
    return error(503, "API_UNAVAILABLE", "API interna não configurada.");
  }

  const headers = new Headers({ accept: "application/json" });
  if (route.startsWith("admin/")) {
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
  }

  let body: ArrayBuffer | undefined;
  if (method !== "GET") {
    const maxBodyBytes = 4_500_000;
    if (Number(request.headers.get("content-length")) > maxBodyBytes) {
      return error(413, "FILE_TOO_LARGE", "Requisição muito grande.");
    }
    body = await request.arrayBuffer();
    if (body.byteLength > maxBodyBytes) {
      return error(413, "FILE_TOO_LARGE", "Requisição muito grande.");
    }
    if (body.byteLength > 0) {
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        return error(415, "UNSUPPORTED_MEDIA_TYPE", "Envie os dados em JSON.");
      }
      headers.set("content-type", "application/json");
    }
  }

  const target = new URL(`/api/v1/${route}${new URL(request.url).search}`, internalOrigin);
  try {
    const upstream = await fetch(target, {
      method, headers, body, cache: "no-store", redirect: "manual", signal: request.signal,
    });
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie && route.startsWith("admin/")) responseHeaders.set("set-cookie", setCookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (cause) {
    console.error("Falha ao conectar ao Fastify interno.", cause);
    return error(502, "API_UNAVAILABLE", "Não foi possível conectar à API interna.");
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
