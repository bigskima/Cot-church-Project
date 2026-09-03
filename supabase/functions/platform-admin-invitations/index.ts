import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, email, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST", "DELETE"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    await authorizePlatform(auth, "platform.roles.manage");

    if (request.method === "GET") {
      const admin = adminClient();
      const [invites, roles] = await Promise.all([
        admin.from("governance_invitations")
          .select("id,target_profile_id,target_email,platform_role_code,invited_by,message,status,expires_at,responded_at,created_at")
          .eq("kind", "platform_role").order("created_at", { ascending: false }).limit(200),
        admin.from("platform_roles").select("code,name,description").order("name"),
      ]);
      if (invites.error || roles.error) throw new ApiError("ADMIN_INVITATIONS_FAILED", "Unable to retrieve admin invitations", 500, undefined, false);
      return { data: { invitations: invites.data ?? [], roles: roles.data ?? [] } };
    }

    const body = assertObject(await jsonBody(request));
    if (request.method === "DELETE") {
      assertNoUnknownFields(body, ["invitationId"]);
      const { data, error } = await auth.client.rpc("revoke_governance_invitation", {
        target_invitation_id: uuid(requiredString(body.invitationId, "invitationId", 64), "invitationId", true),
      }).single();
      if (error?.code === "P0002") throw new ApiError("INVITATION_NOT_FOUND", "Invitation not found", 404);
      if (error?.code === "22023") throw new ApiError("INVITATION_UNAVAILABLE", error.message, 409);
      if (error) throw new ApiError("INVITATION_REVOKE_FAILED", "Unable to revoke invitation", 500, undefined, false);
      return { data };
    }

    assertNoUnknownFields(body, ["email", "roleCode", "message", "validityHours"]);
    const validityHours = body.validityHours === undefined ? 168 : Number(body.validityHours);
    if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > 720) throw new ApiError("VALIDATION_FAILED", "validityHours must be 1-720", 422);
    const { data, error } = await auth.client.rpc("create_platform_role_invitation", {
      target_email: email(body.email),
      target_role_code: requiredString(body.roleCode, "roleCode", 64),
      invite_message: optionalString(body.message, "message", 1000) ?? "",
      validity_hours: validityHours,
    }).single();
    if (error?.code === "P0002") throw new ApiError("USER_OR_ROLE_NOT_FOUND", error.message, 404);
    if (error?.code === "23505") throw new ApiError("ROLE_ALREADY_ASSIGNED", "This user already has the selected platform role", 409);
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "Only authorized Platform Super Admins can invite platform administrators", 403);
    if (error) throw new ApiError("ADMIN_INVITATION_FAILED", "Unable to create admin invitation", 500, undefined, false);
    return { data, status: 201 };
  },
));
