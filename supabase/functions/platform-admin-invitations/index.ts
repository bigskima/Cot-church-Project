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
    const admin = adminClient();
    const url = new URL(request.url);

    if (request.method === "GET" && url.searchParams.get("view") === "pending") {
      const now = new Date().toISOString();
      await admin.from("governance_invitations")
        .update({ status: "expired", responded_at: now })
        .eq("kind", "platform_role")
        .eq("target_profile_id", auth.user.id)
        .eq("status", "pending")
        .lt("expires_at", now);

      const { data: invitations, error } = await admin.from("governance_invitations")
        .select("id,target_email,platform_role_code,invited_by,message,status,expires_at,created_at")
        .eq("kind", "platform_role")
        .eq("target_profile_id", auth.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new ApiError("PLATFORM_INVITATIONS_FAILED", "Unable to retrieve Platform Administrator invitations", 500, undefined, false);

      const roleCodes = [...new Set((invitations ?? []).map((item) => item.platform_role_code).filter(Boolean))] as string[];
      const inviterIds = [...new Set((invitations ?? []).map((item) => item.invited_by).filter(Boolean))] as string[];
      const [roles, inviters] = await Promise.all([
        roleCodes.length ? admin.from("platform_roles").select("code,name,description").in("code", roleCodes) : Promise.resolve({ data: [], error: null }),
        inviterIds.length ? admin.from("profiles").select("id,display_name").in("id", inviterIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (roles.error || inviters.error) throw new ApiError("PLATFORM_INVITATIONS_FAILED", "Unable to resolve Platform Administrator invitation details", 500, undefined, false);
      const roleMap = new Map((roles.data ?? []).map((item: any) => [item.code, item]));
      const inviterMap = new Map((inviters.data ?? []).map((item: any) => [item.id, item]));
      return {
        data: {
          invitations: (invitations ?? []).map((item) => ({
            ...item,
            role: item.platform_role_code ? roleMap.get(item.platform_role_code) ?? null : null,
            invitedBy: item.invited_by ? inviterMap.get(item.invited_by) ?? null : null,
          })),
        },
      };
    }

    const body = request.method === "GET" ? null : assertObject(await jsonBody(request));
    if (request.method === "POST" && body && ("invitationId" in body || "decision" in body)) {
      assertNoUnknownFields(body, ["invitationId", "decision"]);
      const invitationId = uuid(requiredString(body.invitationId, "invitationId", 64), "invitationId", true)!;
      const decision = requiredString(body.decision, "decision", 16).toLowerCase();
      if (!new Set(["accept", "decline"]).has(decision)) throw new ApiError("VALIDATION_FAILED", "Decision must be accept or decline", 422);
      const { data: invitation, error: loadError } = await admin.from("governance_invitations")
        .select("id,kind,target_profile_id")
        .eq("id", invitationId)
        .maybeSingle();
      if (loadError) throw new ApiError("INVITATION_RESPONSE_FAILED", "Unable to inspect invitation", 500, undefined, false);
      if (!invitation || invitation.kind !== "platform_role") throw new ApiError("INVITATION_NOT_FOUND", "Platform Administrator invitation not found", 404);
      if (invitation.target_profile_id !== auth.user.id) throw new ApiError("INVITATION_ACCESS_DENIED", "This invitation does not belong to you", 403);

      const { data, error } = await admin.rpc("respond_platform_role_invitation", {
        target_invitation_id: invitationId,
        target_profile_id: auth.user.id,
        decision,
      }).single();
      if (error?.code === "P0002") throw new ApiError("INVITATION_NOT_FOUND", "Invitation not found", 404);
      if (error?.code === "42501") throw new ApiError("INVITATION_ACCESS_DENIED", "This invitation does not belong to you", 403);
      if (error?.code === "22023") throw new ApiError("INVITATION_UNAVAILABLE", error.message, 409);
      if (error) throw new ApiError("INVITATION_RESPONSE_FAILED", "Unable to respond to invitation", 500, undefined, false);
      return { data };
    }

    await authorizePlatform(auth, "platform.roles.manage");

    if (request.method === "GET") {
      const [invites, roles] = await Promise.all([
        admin.from("governance_invitations")
          .select("id,target_profile_id,target_email,platform_role_code,invited_by,message,status,expires_at,responded_at,created_at")
          .eq("kind", "platform_role").order("created_at", { ascending: false }).limit(200),
        admin.from("platform_roles").select("code,name,description").order("name"),
      ]);
      if (invites.error || roles.error) throw new ApiError("ADMIN_INVITATIONS_FAILED", "Unable to retrieve admin invitations", 500, undefined, false);
      return { data: { invitations: invites.data ?? [], roles: roles.data ?? [] } };
    }

    if (!body) throw new ApiError("VALIDATION_FAILED", "Request body required", 422);
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
