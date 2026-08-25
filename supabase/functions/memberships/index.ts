import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const statuses = new Set(["invited", "active", "inactive", "suspended"]);

Deno.serve(createHandler(
  { methods: ["GET", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (request.method === "GET") {
      await authorize(auth, "members.read");
      const url = new URL(request.url);
      const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new ApiError("VALIDATION_FAILED", "limit must be a positive integer", 422);
      const limit = Math.min(requestedLimit, 100);
      const status = url.searchParams.get("status");
      if (status && !statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid membership status", 422);
      let query = auth.client.from("memberships")
        .select("id, status, joined_at, branch_id, created_at, updated_at, profile:profiles(id, display_name, phone_number, avatar_url), branch:branches(id, name, code)")
        .eq("organization_id", auth.organizationId).order("created_at", { ascending: false }).limit(limit);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new ApiError("MEMBERSHIP_LIST_FAILED", "Unable to list memberships", 500, undefined, false);
      return { data: data ?? [], meta: { limit } };
    }
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["membershipId", "status", "branchId"]);
    const membershipId = uuid(requiredString(body.membershipId, "membershipId", 36), "membershipId", true)!;
    const status = requiredString(body.status, "status", 20);
    if (!statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid membership status", 422);
    const branchId = body.branchId === null || body.branchId === undefined ? null : uuid(requiredString(body.branchId, "branchId", 36), "branchId", true);
    const { data, error } = await auth.client.rpc("update_membership_status", {
      target_organization_id: auth.organizationId,
      target_membership_id: membershipId,
      new_status: status,
      new_branch_id: branchId,
    }).single();
    if (error?.code === "23514") throw new ApiError("LAST_OWNER_PROTECTED", error.message, 409);
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have permission to update this membership", 403);
    if (error) throw new ApiError("MEMBERSHIP_UPDATE_FAILED", "Unable to update membership", 500, undefined, false);
    return { data };
  },
));
