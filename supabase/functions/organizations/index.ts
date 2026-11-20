import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString } from "../_shared/validation.ts";

function slug(value: unknown) {
  const result = requiredString(value, "slug", 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw new ApiError("VALIDATION_FAILED", "Invalid organization slug", 422);
  return result;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    if (request.method === "POST") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["name", "slug", "timezone", "initialBranchName", "initialBranchCode"]);
      const values = {
        organization_name: requiredString(body.name, "name", 160),
        organization_slug: slug(body.slug),
        organization_timezone: optionalString(body.timezone, "timezone", 64) ?? "UTC",
        initial_branch_name: optionalString(body.initialBranchName, "initialBranchName", 160) ?? "Main Expression",
        initial_branch_code: (optionalString(body.initialBranchCode, "initialBranchCode", 40) ?? "MAIN").toUpperCase(),
      };
      const { data, error } = await auth.client.rpc("create_organization", values).single();
      if (error) {
        if (error.code === "23505") throw new ApiError("ORGANIZATION_SLUG_TAKEN", "Organization slug is unavailable", 409);
        if (error.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
        throw new ApiError("ORGANIZATION_CREATE_FAILED", "Unable to create organization", 500, undefined, false);
      }
      return { data, status: 201 };
    }

    if (request.method === "PATCH") {
      if (!auth.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
      await authorize(auth, "organizations.update");
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["name", "timezone", "settings"]);
      const name = optionalString(body.name, "name", 160);
      const timezone = optionalString(body.timezone, "timezone", 64);
      const settings = body.settings;
      if (settings !== undefined && (!settings || typeof settings !== "object" || Array.isArray(settings))) {
        throw new ApiError("VALIDATION_FAILED", "Settings must be an object", 422);
      }
      const updates = {
        ...(name !== undefined ? { name } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(settings !== undefined ? { settings } : {}),
      };
      if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one field is required", 422);
      const { data, error } = await auth.client.from("organizations").update(updates).eq("id", auth.organizationId).select("id, name, slug, status, timezone, settings, updated_at").single();
      if (error) throw new ApiError("ORGANIZATION_UPDATE_FAILED", "Unable to update organization", 500, undefined, false);
      return { data };
    }

    if (auth.organizationId) {
      const { data, error } = await auth.client.from("organizations").select("id, name, slug, status, timezone, settings, created_at, updated_at").eq("id", auth.organizationId).single();
      if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "Organization was not found", 404);
      return { data };
    }
    const { data, error } = await auth.client.from("memberships").select("id, status, joined_at, organization:organizations(id, name, slug, status, timezone)").eq("profile_id", auth.user.id).eq("status", "active").order("created_at");
    if (error) throw new ApiError("ORGANIZATION_LIST_FAILED", "Unable to list organizations", 500, undefined, false);
    return { data: data ?? [] };
  },
));
