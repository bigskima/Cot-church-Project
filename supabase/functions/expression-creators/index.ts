import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, email, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "platform";

    if (request.method === "GET" && mode === "self") {
      const organizationId = uuid(url.searchParams.get("organizationId"), "organizationId", true)!;
      const { data, error } = await auth.client.rpc("has_expression_creator_authorization", {
        target_organization_id: organizationId,
      });
      if (error) throw new ApiError("CREATOR_AUTHORIZATION_CHECK_FAILED", "Unable to verify expression creator authorization", 500, undefined, false);
      return { data: { organizationId, authorized: data === true } };
    }

    await authorizePlatform(auth, "platform.expression_creators.manage");
    const admin = adminClient();

    if (request.method === "GET") {
      const organizationParam = url.searchParams.get("organizationId");
      const organizationId = organizationParam ? uuid(organizationParam, "organizationId", true)! : null;
      let query = admin.from("expression_creator_authorizations")
        .select("organization_id,profile_id,granted_by,is_active,granted_at,revoked_by,revoked_at,updated_at")
        .order("updated_at", { ascending: false });
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query.limit(200);
      if (error) throw new ApiError("CREATOR_AUTHORIZATIONS_FAILED", "Unable to list expression creator authorizations", 500, undefined, false);
      const profileIds = [...new Set((data ?? []).map((item) => item.profile_id))];
      const { data: profiles, error: profileError } = profileIds.length
        ? await admin.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
        : { data: [], error: null };
      if (profileError) throw new ApiError("CREATOR_AUTHORIZATIONS_FAILED", "Unable to resolve authorized users", 500, undefined, false);
      const profileMap = new Map((profiles ?? []).map((item: any) => [item.id, item]));
      const enriched = await Promise.all((data ?? []).map(async (item) => {
        const { data: userData } = await admin.auth.admin.getUserById(item.profile_id);
        return { ...item, profile: profileMap.get(item.profile_id) ?? null, email: userData.user?.email ?? null };
      }));
      return { data: enriched };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["organizationId", "email", "enabled"]);
    if (typeof body.enabled !== "boolean") throw new ApiError("VALIDATION_FAILED", "enabled must be boolean", 422);
    const { data, error } = await auth.client.rpc("set_expression_creator_authorization", {
      target_organization_id: uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true),
      target_email: email(body.email),
      enable_authorization: body.enabled,
    }).single();
    if (error?.code === "P0002") throw new ApiError("USER_OR_ORGANIZATION_NOT_FOUND", error.message, 404);
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "Only Platform Super Admin may change expression creator authorization", 403);
    if (error) throw new ApiError("CREATOR_AUTHORIZATION_SAVE_FAILED", "Unable to update expression creator authorization", 500, undefined, false);
    return { data };
  },
));
