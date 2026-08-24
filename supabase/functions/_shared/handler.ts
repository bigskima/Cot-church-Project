import type { AuthContext } from "./context.ts";
import { authenticate, authorize } from "./context.ts";
import { corsHeaders, preflight } from "./cors.ts";
import { ApiError } from "./errors.ts";
import { log } from "./logging.ts";
import { requestId } from "./request.ts";
import { failure, success } from "./response.ts";

export interface HandlerResult {
  data?: unknown;
  status?: number;
  meta?: Record<string, unknown>;
  headers?: HeadersInit;
}

export interface HandlerOptions {
  methods: string[];
  authentication?: "required" | "none";
  organization?: "required" | "optional" | "none";
  permission?: string;
}

export interface RequestContext {
  request: Request;
  requestId: string;
  auth: AuthContext | null;
}

export function createHandler(options: HandlerOptions, callback: (context: RequestContext) => Promise<HandlerResult> | HandlerResult) {
  const methods = options.methods.map((method) => method.toUpperCase());
  return async (request: Request) => {
    const id = requestId(request);
    const startedAt = performance.now();
    let cors: HeadersInit = {};
    try {
      cors = corsHeaders(request);
      if (request.method === "OPTIONS") return preflight(cors);
      if (!methods.includes(request.method)) {
        throw new ApiError("METHOD_NOT_ALLOWED", "Method not allowed", 405, undefined, true, { Allow: methods.join(", ") });
      }
      const needsAuth = options.authentication !== "none";
      const auth = needsAuth ? await authenticate(request, options.organization === "required") : null;
      if (options.permission) {
        if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
        await authorize(auth, options.permission);
      }
      const result = await callback({ request, requestId: id, auth });
      const responseHeaders = new Headers(cors);
      if (result.headers) new Headers(result.headers).forEach((value, key) => responseHeaders.set(key, value));
      const response = success(result.data ?? null, id, result.status ?? 200, responseHeaders, result.meta);
      log("info", "api_request_completed", { requestId: id, method: request.method, path: new URL(request.url).pathname, status: response.status, durationMs: Math.round(performance.now() - startedAt), userId: auth?.user.id });
      return response;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      log(apiError && apiError.status < 500 ? "warn" : "error", "api_request_failed", {
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
        status: apiError?.status ?? 500,
        code: apiError?.code ?? "INTERNAL_ERROR",
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      const responseHeaders = new Headers(cors);
      if (apiError?.headers) new Headers(apiError.headers).forEach((value, key) => responseHeaders.set(key, value));
      return failure(error, id, responseHeaders);
    }
  };
}
