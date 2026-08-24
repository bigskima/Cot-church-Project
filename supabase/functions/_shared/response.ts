import { ApiError, normalizeError } from "./errors.ts";

export interface ResponseMeta {
  requestId: string;
  [key: string]: unknown;
}

const securityHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function responseHeaders(requestId: string, ...sources: HeadersInit[]) {
  const headers = new Headers(securityHeaders);
  headers.set("X-Request-Id", requestId);
  for (const source of sources) new Headers(source).forEach((value, key) => headers.set(key, value));
  return headers;
}

export function success(
  data: unknown,
  requestId: string,
  status = 200,
  headers: HeadersInit = {},
  meta: Record<string, unknown> = {},
) {
  return new Response(JSON.stringify({ data, meta: { requestId, ...meta } }), {
    status,
    headers: responseHeaders(requestId, headers),
  });
}

export function failure(
  value: unknown,
  requestId: string,
  headers: HeadersInit = {},
) {
  const error = normalizeError(value);
  return new Response(JSON.stringify({
    error: {
      code: error.code,
      message: error.expose ? error.message : "An unexpected error occurred",
      ...(error.expose && error.details ? { details: error.details } : {}),
      requestId,
    },
  }), {
    status: error.status,
    headers: responseHeaders(requestId, headers),
  });
}

/** @deprecated Use success or failure so responses include the stable API envelope. */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: securityHeaders });
}

export function methodNotAllowed(methods: string[]) {
  return new ApiError("METHOD_NOT_ALLOWED", "Method not allowed", 405, undefined, true, {
    Allow: methods.join(", "),
  });
}
