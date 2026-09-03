import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, email } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (!auth.branchId) throw new ApiError("EXPRESSION_REQUIRED", "Select an Expression first", 400);
    const admin = adminClient();

    if (request.method === "GET") {
      const { data: ownership, error } = await admin.from("expression_ownerships")
        .select("branch_id,organization_id,owner_profile_id,assigned_by,created_at,transferred_at")
        .eq("branch_id", auth.branchId).eq("organization_id", auth.organizationId).maybeSingle();
      if (error) throw new ApiError("EXPRESSION_OWNERSHIP_FAILED", "Unable to retrieve Expression ownership", 500, undefined, false);
      if (!ownership) throw new ApiError("EXPRESSION_OWNERSHIP_NOT_FOUND", "Expression ownership has not been configured", 404);
      const [{ data: profile }, ownerUser] = await Promise.all([
        admin.from("profiles").select("id,display_name,avatar_url").eq("id", ownership.owner_profile_id).maybeSingle(),
        admin.auth.admin.getUserById(ownership.owner_profile_id),
      ]);
      return {
        data: {
          ...ownership,
          owner: profile ? { ...profile, email: ownerUser.data.user?.email ?? null } : { id: ownership.owner_profile_id, email: ownerUser.data.user?.email ?? null },
          isCurrentOwner: ownership.owner_profile_id === auth.user.id,
        },
      };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["email", "retainPreviousAdmin"]);
    if (body.retainPreviousAdmin !== undefined && typeof body.retainPreviousAdmin !== "boolean") {
      throw new ApiError("VALIDATION_FAILED", "retainPreviousAdmin must be boolean", 422);
    }
    const { data, error } = await auth.client.rpc("transfer_expression_ownership_by_email", {
      target_branch_id: auth.branchId,
      target_email: email(body.email),
      retain_previous_admin: body.retainPreviousAdmin === true,
    }).single();
    if (error?.code === "P0002") throw new ApiError("USER_NOT_FOUND", "Registered user not found", 404);
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "Only the current Expression owner can transfer ownership", 403);
    if (error?.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
    if (error) throw new ApiError("OWNERSHIP_TRANSFER_FAILED", "Unable to transfer Expression ownership", 500, undefined, false);
    return { data };
  },
));
