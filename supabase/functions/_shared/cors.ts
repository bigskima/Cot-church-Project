import { getAllowedOrigins } from "./config.ts";
import { ApiError } from "./errors.ts";

const allowedHeaders = "authorization, content-type, idempotency-key, x-branch-id, x-organization-id, x-request-id";

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = getAllowedOrigins();
  const isPermitted =
    allowed.length === 0 ||
    allowed.includes("*") ||
    allowed.includes(origin) ||
    origin.endsWith(".vercel.app") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");

  if (!isPermitted) throw new ApiError("ORIGIN_NOT_ALLOWED", "Origin not allowed", 403);
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(headers: HeadersInit) {
  return new Response(null, { status: 204, headers });
}
