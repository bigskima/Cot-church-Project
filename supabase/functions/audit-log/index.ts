import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(createHandler({ methods: ["GET"], authentication: "required", organization: "required", permission: "audit.read" }, async ({ request, auth }) => {
  if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
  const url = new URL(request.url); const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
  let query = auth.client.from("audit_log").select("id, branch_id, actor_profile_id, action, target_type, target_id, request_id, old_values, new_values, occurred_at").eq("organization_id", auth.organizationId).order("occurred_at", { ascending: false }).limit(Number.isFinite(limit) ? limit : 50);
  if (url.searchParams.get("action")) query = query.eq("action", url.searchParams.get("action")!); if (url.searchParams.get("targetType")) query = query.eq("target_type", url.searchParams.get("targetType")!);
  const { data, error } = await query; if (error) throw new ApiError("AUDIT_LIST_FAILED", "Unable to retrieve audit records", 500, undefined, false); return { data: data ?? [], meta: { limit } };
}));
