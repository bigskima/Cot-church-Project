import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError } from "./errors.ts";

export async function resolveActiveOrganizationId(
  admin: SupabaseClient,
  requestedOrganizationId?: string | null,
) {
  if (requestedOrganizationId) {
    const { data, error } = await admin
      .from("organizations")
      .select("id,status")
      .eq("id", requestedOrganizationId)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) {
      throw new ApiError("ORGANIZATION_NOT_FOUND", "This church community is not available", 404);
    }
    return data.id as string;
  }

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(2);
  if (error) {
    throw new ApiError("ORGANIZATION_LOOKUP_FAILED", "Unable to resolve the General community", 500, undefined, false);
  }
  if ((data ?? []).length === 1) return data![0].id as string;
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church community before publishing", 422);
}
