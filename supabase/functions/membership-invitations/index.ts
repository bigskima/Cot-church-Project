import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, email, phone, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PUT", "DELETE"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    if (request.method === "PUT") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["token"]);
      const { data, error } = await auth.client.rpc("accept_membership_invitation", {
        raw_invitation_token: requiredString(body.token, "token", 128),
      }).single();
      if (error?.code === "P0002") throw new ApiError("INVITATION_NOT_FOUND", "Invitation is invalid", 404);
      if (error?.code === "22023") throw new ApiError("INVITATION_EXPIRED", "Invitation has expired", 410);
      if (error?.code === "42501") throw new ApiError("INVITATION_IDENTITY_MISMATCH", "Invitation does not match this identity", 403);
      if (error) throw new ApiError("INVITATION_ACCEPT_FAILED", "Unable to accept invitation", 500, undefined, false);
      return { data };
    }
    if (!auth.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (request.method === "GET") {
      const { data, error } = await auth.client.from("membership_invitations")
        .select("id, branch_id, invited_email, invited_phone, status, expires_at, accepted_at, created_at, updated_at")
        .eq("organization_id", auth.organizationId).order("created_at", { ascending: false }).limit(100);
      if (error) throw new ApiError("INVITATION_LIST_FAILED", "Unable to list invitations", 500, undefined, false);
      return { data: data ?? [] };
    }
    const body = assertObject(await jsonBody(request));
    if (request.method === "DELETE") {
      assertNoUnknownFields(body, ["invitationId"]);
      const { error } = await auth.client.rpc("revoke_membership_invitation", {
        target_invitation_id: uuid(requiredString(body.invitationId, "invitationId", 36), "invitationId", true),
      });
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "Permission denied", 403);
      if (error) throw new ApiError("INVITATION_REVOKE_FAILED", "Unable to revoke invitation", 500, undefined, false);
      return { data: { status: "revoked" } };
    }
    assertNoUnknownFields(body, ["email", "phoneNumber", "branchId", "validityHours"]);
    const invitedEmail = body.email === undefined ? null : email(body.email);
    const invitedPhone = body.phoneNumber === undefined ? null : phone(body.phoneNumber);
    if ((invitedEmail ? 1 : 0) + (invitedPhone ? 1 : 0) !== 1) throw new ApiError("VALIDATION_FAILED", "Provide exactly one email or phone number", 422);
    const validityHours = body.validityHours === undefined ? 72 : Number(body.validityHours);
    if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > 168) throw new ApiError("VALIDATION_FAILED", "validityHours must be 1-168", 422);
    const { data, error } = await auth.client.rpc("create_membership_invitation", {
      target_organization_id: auth.organizationId,
      target_branch_id: body.branchId ? uuid(String(body.branchId), "branchId", true) : null,
      target_email: invitedEmail,
      target_phone: invitedPhone,
      validity_hours: validityHours,
    }).single();
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "Permission denied", 403);
    if (error) throw new ApiError("INVITATION_CREATE_FAILED", "Unable to create invitation", 500, undefined, false);
    return { data: { id: data.invitation_id, status: "pending", expiresAt: data.expires_at }, status: 201 };
  },
));
