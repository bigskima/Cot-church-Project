import { ApiError } from "./errors.ts";

const maxBodyBytes = 64 * 1024;

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
  return match[1];
}

export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBodyBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Request body is too large", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBodyBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Request body is too large", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("INVALID_JSON", "Request body contains invalid JSON", 400);
  }
}
