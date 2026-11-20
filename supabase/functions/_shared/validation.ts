import { ApiError } from "./errors.ts";

export type Issues = Record<string, string>;

export function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_FAILED", "Request body must be a JSON object", 422);
  }
  return value as Record<string, unknown>;
}

export function assertNoUnknownFields(value: Record<string, unknown>, allowed: string[]) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ApiError("VALIDATION_FAILED", "Request contains unknown fields", 422, { fields: unknown });
}

export function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}`, 422, { [field]: `Must be between 1 and ${maxLength} characters` });
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string, maxLength: number) {
  return value === undefined ? undefined : requiredString(value, field, maxLength);
}

export function email(value: unknown) {
  const normalized = requiredString(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError("VALIDATION_FAILED", "Invalid email", 422, { email: "Must be a valid email address" });
  }
  return normalized;
}

export function phone(value: unknown) {
  const normalized = requiredString(value, "phoneNumber", 16);
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new ApiError("VALIDATION_FAILED", "Invalid phone number", 422, { phoneNumber: "Must use E.164 format" });
  }
  return normalized;
}


export function uuid(value: string | null, field: string, required = false) {
  if (!value && !required) return null;
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError("VALIDATION_FAILED", `Invalid ${field}`, 422, { [field]: "Must be a UUID" });
  }
  return value;
}
