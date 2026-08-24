export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
    public readonly expose = true,
    public readonly headers: HeadersInit = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeError(value: unknown): ApiError {
  if (value instanceof ApiError) return value;
  return new ApiError("INTERNAL_ERROR", "Internal server error", 500, undefined, false);
}
