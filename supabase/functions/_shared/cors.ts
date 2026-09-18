import { getAllowedOrigins } from "./config.ts";
import { ApiError } from "./errors.ts";
import { adminClient } from "./supabase.ts";

const allowedHeaders = "authorization, content-type, idempotency-key, x-branch-id, x-organization-id, x-request-id";
const DATABASE_ORIGIN_CACHE_MS = 60_000;

let databaseOriginCache: { expiresAt: number; patterns: string[] } | null = null;

function normalizePattern(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function originMatchesPattern(origin: string, pattern: string) {
  const normalizedPattern = normalizePattern(pattern);
  if (!normalizedPattern) return false;
  if (normalizedPattern === "*") return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const normalizedOrigin = parsedOrigin.origin.toLowerCase();

  if (!normalizedPattern.includes("*")) {
    try {
      return new URL(normalizedPattern).origin.toLowerCase() === normalizedOrigin;
    } catch {
      return false;
    }
  }

  const separatorIndex = normalizedPattern.indexOf("://");
  if (separatorIndex <= 0) return false;

  const scheme = normalizedPattern.slice(0, separatorIndex).toLowerCase();
  const hostPattern = normalizedPattern.slice(separatorIndex + 3).toLowerCase();
  if (!hostPattern || hostPattern.includes("/") || hostPattern.includes("?") || hostPattern.includes("#")) return false;
  if (parsedOrigin.protocol.toLowerCase() !== `${scheme}:`) return false;

  const escapedHostPattern = hostPattern
    .replace(/[.+?^$(){}|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");

  return new RegExp(`^${escapedHostPattern}$`, "i").test(parsedOrigin.host);
}

async function databaseAllowedOrigins() {
  const now = Date.now();
  if (databaseOriginCache && databaseOriginCache.expiresAt > now) return databaseOriginCache.patterns;

  try {
    const { data, error } = await adminClient()
      .from("platform_web_origins")
      .select("origin_pattern")
      .eq("is_active", true);

    if (error) throw error;

    const patterns = (data ?? [])
      .map((row) => typeof row.origin_pattern === "string" ? normalizePattern(row.origin_pattern) : "")
      .filter(Boolean);

    databaseOriginCache = { expiresAt: now + DATABASE_ORIGIN_CACHE_MS, patterns };
    return patterns;
  } catch {
    // During migration/deployment skew, retain the environment allowlist rather
    // than failing every request because the configuration table is unavailable.
    databaseOriginCache = { expiresAt: now + 5_000, patterns: [] };
    return [];
  }
}

export async function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return {};

  const configured = [
    ...getAllowedOrigins().map(normalizePattern),
    ...await databaseAllowedOrigins(),
  ].filter(Boolean);

  // Preserve the historical development fallback when no origin policy exists
  // anywhere. Production COT keeps explicit rules through Edge secrets and/or
  // platform_web_origins.
  const isPermitted = configured.length === 0 || configured.some((pattern) => originMatchesPattern(origin, pattern));

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
