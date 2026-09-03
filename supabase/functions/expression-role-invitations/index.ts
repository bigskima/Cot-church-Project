import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, email, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST", "DELETE"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (!auth.branchId) throw new ApiError("EXPRESSION_REQUIRED", "Select an expression first", 400);
    await authorize(auth, "members.invite");
    await authorize(auth, "roles.assign");

    if (request.method === "GET") {
      const [invites, roles] = await Promise.all([
        auth.client.from("governance_invitations")
          .select("id,target_profile_id,target_email,organization_role_id,invited_by,message,status,expires_at,responded_at,created_at")
          .eq("kind", "expression_role").eq("organization_id", auth.organizationId).eq("branch_id", auth.branchId)
          .order("created_at", { ascending: false }).limit(200),
        auth.client.from("roles").select("id,code,name,description,is_system").eq("organization_id", auth.organizationId).neq("code", "owner").order("name"),
      ]);
      if (invites.error || roles.error) throw new ApiError("EXPRESSION_INVITATIONS_FAILED", "Unable to retrieve expression invitations", 500, undefined, false);
      return { data: { invitations: invites.data ?? [], roles: roles.data ?? [] } };
    }

    const body = assertObject(await jsonBody(request));
    if (request.method === "DELETE") {
      assertNoUnknownFields(body, ["invitationId"]);
      const { data, error } = await auth.client.rpc("revoke_governance_invitation", {
        target_invitation_id: uuid(requiredString(body.invitationId, "invitationId", 64), "invitationId", true),
      }).single();
      if (error?.code === "P0002") throw new ApiError("INVITATION_NOT_FOUND", "Invitation not found", 404);
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You cannot revoke this invitation", 403);
      if (error?.code === "22023") throw new ApiError("INVITATION_UNAVAILABLE", error.message, 409);
      if (error) throw new ApiError("INVITATION_REVOKE_FAILED", "Unable to revoke invitation", 500, undefined, false);
      return { data };
    }

    assertNoUnknownFields(body, ["email", "roleId", "message", "validityHours"]);
    const validityHours = body.validityHours === undefined ? 168 : Number(body.validityHours);
    if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > 720) throw new ApiError("VALIDATION_FAILED", "validityHours must be 1-720", 422);
    const { data, error } = await auth.client.rpc("create_expression_role_invitation", {
      target_organization_id: auth.organizationId,
      target_branch_id: auth.branchId,
      target_email: email(body.email),
      target_role_id: uuid(requiredString(body.roleId, "roleId", 64), "roleId", true),
      invite_message: optionalString(body.message, "message", 1000) ?? "",
      validity_hours: validityHours,
    }).single();
    if (error?.code === "P0002") throw new ApiError("USER_ROLE_OR_EXPRESSION_NOT_FOUND", error.message, 404);
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You cannot invite users into this expression", 403);
    if (error?.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
    if (error) throw new ApiError("EXPRESSION_INVITATION_FAILED", "Unable to create expression role invitation", 500, undefined, false);
    return { data, status: 201 };
  },
));
