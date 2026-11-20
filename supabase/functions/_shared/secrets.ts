import { ApiError } from './errors.ts';
import { adminClient } from './supabase.ts';

function normalizedReference(reference: string) {
  const value = reference.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(value)) {
    throw new ApiError('INVALID_SECRET_REFERENCE', 'Server secret reference is invalid', 500, undefined, false);
  }
  return value;
}

// Synchronous resolver retained for deployment-owned secrets that must remain environment-only.
export function secretValue(reference: string) {
  const normalized = normalizedReference(reference);
  const value = Deno.env.get(normalized);
  if (!value) throw new ApiError('SECRET_UNAVAILABLE', 'Required server secret is unavailable', 500, undefined, false);
  return value;
}

export function secretJson<T>(reference: string): T {
  const raw = secretValue(reference);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError('SECRET_INVALID', 'Server secret is not valid JSON', 500, undefined, false);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('SECRET_INVALID', 'Server secret has an invalid shape', 500, undefined, false);
  }
  return value as T;
}

// Provider adapters use this asynchronous resolver. Environment secrets take precedence for
// backwards compatibility; Platform Admin-managed credentials are resolved from Supabase Vault.
export async function resolveSecretValue(reference: string) {
  const normalized = normalizedReference(reference);
  const environmentValue = Deno.env.get(normalized);
  if (environmentValue) return environmentValue;

  const { data, error } = await adminClient().rpc('resolve_runtime_secret', {
    target_reference: normalized,
  });
  if (error || typeof data !== 'string' || !data) {
    throw new ApiError('SECRET_UNAVAILABLE', 'Required server secret is unavailable', 500, undefined, false);
  }
  return data;
}

export async function resolveSecretJson<T>(reference: string): Promise<T> {
  const raw = await resolveSecretValue(reference);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError('SECRET_INVALID', 'Server secret is not valid JSON', 500, undefined, false);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('SECRET_INVALID', 'Server secret has an invalid shape', 500, undefined, false);
  }
  return value as T;
}
