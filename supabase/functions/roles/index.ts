import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

function permissionCodes(value: unknown) {
  if (!Array.isArray(value) || value.length > 250 || value.some((code) => typeof code !== "string" || !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(code))) {
    throw new ApiError("VALIDATION_FAILED", "permissionCodes must contain valid permission codes", 422);
  }
  return [...new Set(value as string[])];
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (request.method === "GET") {
      await authorize(auth, "roles.read");
      const { data, error } = await auth.client.from("roles").select("id, code, name, description, is_system, created_at, updated_at, role_permissions(permission_code)").eq("organization_id", auth.organizationId).order("name");
      if (error) throw new ApiError("ROLE_LIST_FAILED", "Unable to list roles", 500, undefined, false);
      return { data: data ?? [] };
    }
    const body = assertObject(await jsonBody(request));
    if (request.method === "POST") {
      assertNoUnknownFields(body, ["code", "name", "description", "permissionCodes"]);
      const code = requiredString(body.code, "code", 60).toLowerCase();
      const { data, error } = await auth.client.rpc("create_custom_role", {
        target_organization_id: auth.organizationId,
        role_code: code,
        role_name: requiredString(body.name, "name", 120),
        role_description: optionalString(body.description, "description", 500) ?? "",
        permission_codes: permissionCodes(body.permissionCodes),
      }).single();
      if (error?.code === "23505") throw new ApiError("ROLE_CODE_TAKEN", "Role code is already in use", 409);
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have permission to create roles", 403);
      if (error) throw new ApiError("ROLE_CREATE_FAILED", "Unable to create role", 500, undefined, false);
      return { data, status: 201 };
    }
    assertNoUnknownFields(body, ["roleId", "name", "description", "permissionCodes"]);
    const { data, error } = await auth.client.rpc("update_custom_role", {
      target_organization_id: auth.organizationId,
      target_role_id: uuid(requiredString(body.roleId, "roleId", 36), "roleId", true),
      role_name: requiredString(body.name, "name", 120),
      role_description: optionalString(body.description, "description", 500) ?? "",
      permission_codes: permissionCodes(body.permissionCodes),
    }).single();
    if (error?.code === "42501") throw new ApiError("SYSTEM_ROLE_PROTECTED", "System roles cannot be modified", 403);
    if (error) throw new ApiError("ROLE_UPDATE_FAILED", "Unable to update role", 500, undefined, false);
    return { data };
  },
));
