// Server-only BFF: import exclusively from Route Handlers, never Client Components.
import { isIP } from "node:net";

const cookieName = "brewlite-session";
const cookiePath = "/api/session";
const maxAuthBodyBytes = 16_384;
// Preserve the Express JSON parser contract for order and recipe payloads.
const maxProxyBodyBytes = 100 * 1024;
const readMethods = new Set(["GET", "HEAD"]);
const proxyRoutes: [RegExp, string[]][] = [
  [/^auth\/me$/, ["GET", "PATCH"]],
  [/^auth\/change-password$/, ["POST"]],
  [/^orders\/(me|[1-9]\d*)$/, ["GET"]],
  [/^orders$/, ["POST"]],
  [/^payments$/, ["POST"]],
  [/^payments\/zalopay\/create$/, ["POST"]],
  [/^payments\/[1-9]\d*\/(status|details)$/, ["GET"]],
  [/^admin\/orders(?:\/[1-9]\d*)?$/, ["GET"]],
  [/^admin\/orders\/[1-9]\d*\/status$/, ["PATCH"]],
  [/^admin\/orders\/[1-9]\d*\/cancel$/, ["POST"]],
  [/^payments\/admin\/transactions(?:\/[1-9]\d*)?$/, ["GET"]],
  [/^payments\/admin\/transactions\/[1-9]\d*\/note$/, ["PATCH"]],
  [/^payments\/admin\/transactions\/[1-9]\d*\/recheck$/, ["POST"]],
  [/^payments\/admin\/reconciliation$/, ["GET"]],
  [/^ingredients\/[1-9]\d*\/(restock|adjust)$/, ["POST"]],
  [/^ingredients\/[1-9]\d*\/movements$/, ["GET"]],
  [/^ingredients(?:\/[1-9]\d*)?$/, ["GET", "POST", "PATCH", "DELETE"]],
  [/^recipes(?:\/[1-9]\d*)?$/, ["GET", "POST", "PATCH", "DELETE"]],
];

function reply(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function origin(request: Request): string {
  if (process.env.APP_ORIGIN) return new URL(process.env.APP_ORIGIN).origin;
  const url = new URL(request.url);
  url.host = request.headers.get("host") ?? url.host;
  return url.origin;
}
function cookie(value: string, expiresAt: number, request: Request): string {
  const secure = new URL(origin(request)).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${value}; Path=${cookiePath}; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}
function clearCookie(response: Response, request: Request): Response {
  response.headers.set("Set-Cookie", cookie("", 0, request));
  return response;
}
function tokenFrom(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map((v) => v.trim()).filter((v) => v.startsWith(`${cookieName}=`));
  if (values.length !== 1) return null;
  const value = values[0].slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) && value.length <= 4096 ? value : null;
}
function metadata(token: string): { userId: number; expiresAt: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (!Number.isSafeInteger(payload.sub) || payload.sub < 1 || !Number.isSafeInteger(payload.exp) || payload.exp * 1000 <= Date.now()) return null;
    return { userId: payload.sub, expiresAt: payload.exp * 1000 };
  } catch { return null; }
}
async function readBody(request: Request, maxBodyBytes: number): Promise<string | undefined> {
  if (readMethods.has(request.method) || !request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBodyBytes) { await reader.cancel(); throw new Error("body-too-large"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
async function backend(request: Request, path: string, token?: string, body?: string): Promise<Response> {
  const secret = process.env.BFF_PROXY_SECRET;
  if (!secret) throw new Error("bff-proxy-not-configured");
  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const key = request.headers.get("idempotency-key");
  if (key) headers.set("Idempotency-Key", key);
  // server.mjs overwrites XFF from the socket before Next sees any request.
  // Without that server entry point, never enable BFF_PROXY_SECRET.
  const ip = request.headers.get("x-forwarded-for");
  if (ip && isIP(ip)) {
    headers.set("x-brewlite-client-ip", ip);
    headers.set("x-brewlite-proxy-secret", secret);
  }
  return fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/${path}${new URL(request.url).search}`, {
    method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
}
async function validatedSession(request: Request, token: string) {
  const session = metadata(token);
  if (!session) return null;
  const profile = await backend(new Request(request.url, { headers: request.headers }), "auth/me", token);
  if (profile.status === 401) return null;
  if (!profile.ok) throw new Error("session-unavailable");
  const user: unknown = await profile.json();
  if (!user || typeof user !== "object" || !("id" in user) || user.id !== session.userId) return null;
  return session;
}

export async function handleSessionRequest(request: Request, segments: string[]): Promise<Response> {
  try {
    if (!readMethods.has(request.method) && (
      request.headers.get("origin") !== origin(request) ||
      request.headers.get("x-brewlite-csrf") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )) return reply({ message: "Yêu cầu khác nguồn không được chấp nhận." }, 403);

    const [action, ...rest] = segments;
    if (rest.length === 0 && action === "logout" && request.method === "POST") {
      const token = tokenFrom(request);
      if (token && metadata(token)) {
        const upstream = await backend(request, "auth/logout", token);
        // Keep the cookie on outage so retry can still revoke the same credential.
        if (!upstream.ok && upstream.status !== 401) return reply({ message: "Chưa thu hồi được phiên. Vui lòng thử đăng xuất lại." }, 503);
      }
      return clearCookie(reply({ message: "Đã đăng xuất trên mọi thiết bị." }), request);
    }
    if (rest.length === 0 && ["login", "register"].includes(action) && request.method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ message: "JSON required" }, 415);
      const upstream = await backend(request, `auth/${action}`, undefined, await readBody(request, maxAuthBodyBytes));
      const data = await upstream.json();
      if (!upstream.ok || action === "register") return reply(data, upstream.status);
      if (typeof data.accessToken !== "string") throw new Error("invalid-session");
      const session = await validatedSession(request, data.accessToken);
      if (!session) return reply({ message: "Phiên đăng nhập không hợp lệ." }, 401);
      const response = reply(session);
      response.headers.set("Set-Cookie", cookie(data.accessToken, session.expiresAt, request));
      return response;
    }
    const isSession = action === "me" && rest.length === 0 && request.method === "GET";
    const path = rest.join("/");
    if (!isSession && !(action === "proxy" && rest.every((segment) => /^[a-zA-Z0-9-]+$/.test(segment)) && proxyRoutes.some(([pattern, methods]) => pattern.test(path) && methods.includes(request.method)))) {
      return reply({ message: "Not found" }, 404);
    }
    const token = tokenFrom(request);
    if (!token || !metadata(token)) return reply({ message: "Vui lòng đăng nhập lại." }, 401);
    if (isSession) {
      const session = await validatedSession(request, token);
      return session ? reply(session) : reply({ message: "Phiên đã hết hạn hoặc bị thu hồi." }, 401);
    }
    if (!readMethods.has(request.method) && !request.headers.get("content-type")?.startsWith("application/json")) return reply({ message: "JSON required" }, 415);
    const upstream = await backend(request, path, token, await readBody(request, maxProxyBodyBytes));
    const response = reply(await upstream.json(), upstream.status);
    const retry = upstream.headers.get("retry-after");
    if (retry) response.headers.set("Retry-After", retry);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "body-too-large") return reply({ message: "Yêu cầu quá lớn." }, 413);
    return reply({ message: "Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau." }, 503);
  }
}
