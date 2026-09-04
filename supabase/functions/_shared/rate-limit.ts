import { getRateLimitPepper } from "./config.ts";
import { ApiError } from "./errors.ts";
import { publicClient } from "./supabase.ts";

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(request: Request, bucket: string, subject: string, maximumRequests: number, windowSeconds: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwarded ?? request.headers.get("cf-connecting-ip") ?? "unknown";
  const subjectHash = await sha256(`${getRateLimitPepper()}:${clientAddress}:${subject.toLowerCase()}`);
  const { data, error } = await publicClient().rpc("consume_rate_limit", {
    rate_bucket: bucket,
    rate_subject_hash: subjectHash,
    maximum_requests: maximumRequests,
    window_seconds: windowSeconds,
  }).single();
  if (error || !data) throw new ApiError("RATE_LIMIT_UNAVAILABLE", "Request protection is temporarily unavailable", 503);
  const result = data as unknown as { allowed: boolean; remaining: number; resets_at: string };
  if (!result.allowed) throw new ApiError("RATE_LIMITED", "Too many requests", 429, { resetsAt: result.resets_at });
  return { remaining: result.remaining, resetsAt: result.resets_at };
}
