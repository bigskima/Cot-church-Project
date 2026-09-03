import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

function branchCode(value: unknown) {
  const code = requiredString(value, "code", 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new ApiError("VALIDATION_FAILED", "Invalid expression code", 422);
  return code;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    const url = new URL(request.url);
    const branchId = uuid(url.searchParams.get("id"), "id", request.method === "PATCH");

    if (request.method === "GET") {
      const { data, error } = await auth.client.from("branches")
        .select("id, parent_branch_id, name, code, timezone, address, is_active, created_at, updated_at")
        .eq("organization_id", auth.organizationId).order("name");
      if (error) throw new ApiError("EXPRESSION_LIST_FAILED", "Unable to list expressions", 500, undefined, false);
      return { data: data ?? [] };
    }

    const body = assertObject(await jsonBody(request));
    if (request.method === "POST") {
      assertNoUnknownFields(body, ["name", "code", "timezone", "parentBranchId", "address"]);
      const parentBranchId = body.parentBranchId === undefined || body.parentBranchId === null
        ? null
        : uuid(String(body.parentBranchId), "parentBranchId", true);
      const address = body.address ?? {};
      if (!address || typeof address !== "object" || Array.isArray(address)) throw new ApiError("VALIDATION_FAILED", "Address must be an object", 422);
      const { data, error } = await auth.client.rpc("create_authorized_expression", {
        target_organization_id: auth.organizationId,
        expression_name: requiredString(body.name, "name", 160),
        expression_code: branchCode(body.code),
        expression_timezone: optionalString(body.timezone, "timezone", 64) ?? "UTC",
        parent_expression_id: parentBranchId,
        expression_address: address,
      }).single();
      if (error?.code === "42501") throw new ApiError("EXPRESSION_CREATOR_AUTHORIZATION_REQUIRED", "You have not been authorized by Platform Authority to create an expression", 403);
      if (error?.code === "23505") throw new ApiError("EXPRESSION_CODE_TAKEN", "Expression code is already in use", 409);
      if (error?.code === "22023") throw new ApiError("VALIDATION_FAILED", error.message, 422);
      if (error) throw new ApiError("EXPRESSION_CREATE_FAILED", "Unable to create expression", 500, undefined, false);
      return { data, status: 201 };
    }

    await authorize({ ...auth, branchId }, "branches.update");
    assertNoUnknownFields(body, ["name", "code", "timezone", "parentBranchId", "address", "isActive"]);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = requiredString(body.name, "name", 160);
    if (body.code !== undefined) updates.code = branchCode(body.code);
    if (body.timezone !== undefined) updates.timezone = requiredString(body.timezone, "timezone", 64);
    if (body.parentBranchId !== undefined) updates.parent_branch_id = body.parentBranchId === null ? null : uuid(String(body.parentBranchId), "parentBranchId", true);
    if (body.address !== undefined) {
      if (!body.address || typeof body.address !== "object" || Array.isArray(body.address)) throw new ApiError("VALIDATION_FAILED", "Address must be an object", 422);
      updates.address = body.address;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new ApiError("VALIDATION_FAILED", "isActive must be boolean", 422);
      updates.is_active = body.isActive;
    }
    if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one field is required", 422);
    const { data, error } = await auth.client.from("branches").update(updates)
      .eq("id", branchId!).eq("organization_id", auth.organizationId)
      .select("id, parent_branch_id, name, code, timezone, address, is_active").single();
    if (error?.code === "23505") throw new ApiError("EXPRESSION_CODE_TAKEN", "Expression code is already in use", 409);
    if (error) throw new ApiError("EXPRESSION_UPDATE_FAILED", "Unable to update expression", 500, undefined, false);
    return { data };
  },
));
