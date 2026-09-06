import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    if (request.method === "GET") {
      await authorizePlatform(auth, "platform.roles.read");
      const url = new URL(request.url);
      const profileId = url.searchParams.get("profileId")
        ? uuid(url.searchParams.get("profileId"), "profileId", true)!
        : null;

      const { data: capabilities, error: capabilityError } = await auth.client
        .from("permissions")
        .select("code,name,description,category")
        .eq("category", "public")
        .eq("is_active", true)
        .order("name");
      if (capabilityError) throw new ApiError("PUBLIC_CAPABILITIES_FAILED", "Unable to load public COT permissions", 500, undefined, false);

      if (!profileId) return { data: { capabilities: capabilities ?? [], assignments: [], platformRoles: [] } };

      const [{ data: assignments, error: assignmentError }, { data: platformRoles, error: platformRoleError }] = await Promise.all([
        auth.client
          .from("public_capability_assignments")
          .select("id,profile_id,permission_code,is_active,reason,granted_at,revoked_at,expires_at,updated_at")
          .eq("profile_id", profileId)
          .order("updated_at", { ascending: false }),
        auth.client
          .from("platform_role_assignments")
          .select("id,role_code,expires_at,created_at,platform_roles(code,name,description)")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),
      ]);
      if (assignmentError || platformRoleError) {
        throw new ApiError("ROLE_ACCESS_FAILED", "Unable to load this account’s roles and access", 500, undefined, false);
      }

      return { data: { capabilities: capabilities ?? [], assignments: assignments ?? [], platformRoles: platformRoles ?? [] } };
    }

    await authorizePlatform(auth, "platform.roles.manage");
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["profileId", "permissionCode", "enabled", "reason"]);
    const profileId = uuid(requiredString(body.profileId, "profileId", 64), "profileId", true)!;
    const permissionCode = requiredString(body.permissionCode, "permissionCode", 120);
    if (typeof body.enabled !== "boolean") throw new ApiError("VALIDATION_FAILED", "Choose whether this permission should be granted or revoked", 422);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";

    const { data, error } = await auth.client.rpc("set_public_capability_assignment", {
      target_profile_id: profileId,
      target_permission_code: permissionCode,
      enable_capability: body.enabled,
      assignment_reason: reason,
    }).single();
    if (error?.code === "42501") throw new ApiError("PLATFORM_PERMISSION_DENIED", "You do not have permission to manage public COT access", 403);
    if (error?.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
    if (error?.code === "P0002") throw new ApiError("PROFILE_NOT_FOUND", "The selected account could not be found", 404);
    if (error || !data) throw new ApiError("PUBLIC_CAPABILITY_UPDATE_FAILED", "Unable to update this public COT permission", 500, undefined, false);
    return { data };
  },
));