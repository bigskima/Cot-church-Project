import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST", "DELETE"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    if (request.method === "GET") {
      await authorize(auth, "roles.read");
      const membershipId = uuid(new URL(request.url).searchParams.get("membershipId"), "membershipId");
      let query = auth.client.from("role_assignments").select("id, membership_id, branch_id, expires_at, created_at, role:roles(id, code, name, is_system), branch:branches(id, name, code)").eq("organization_id", auth.organizationId).order("created_at");
      if (membershipId) query = query.eq("membership_id", membershipId);
      const { data, error } = await query;
      if (error) throw new ApiError("ASSIGNMENT_LIST_FAILED", "Unable to list role assignments", 500, undefined, false);
      return { data: data ?? [] };
    }
    const body = assertObject(await jsonBody(request));
    if (request.method === "POST") {
      assertNoUnknownFields(body, ["membershipId", "roleId", "branchId", "expiresAt"]);
      const expiresAt = optionalString(body.expiresAt, "expiresAt", 40);
      if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new ApiError("VALIDATION_FAILED", "expiresAt must be an ISO timestamp", 422);
      const { data, error } = await auth.client.rpc("assign_role", {
        target_organization_id: auth.organizationId,
        target_membership_id: uuid(requiredString(body.membershipId, "membershipId", 36), "membershipId", true),
        target_role_id: uuid(requiredString(body.roleId, "roleId", 36), "roleId", true),
        target_branch_id: body.branchId ? uuid(requiredString(body.branchId, "branchId", 36), "branchId", true) : null,
        assignment_expires_at: expiresAt ?? null,
      }).single();
      if (error?.code === "23505") throw new ApiError("ASSIGNMENT_EXISTS", "This role assignment already exists", 409);
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", error.message, 403);
      if (error) throw new ApiError("ASSIGNMENT_CREATE_FAILED", "Unable to create role assignment", 500, undefined, false);
      return { data, status: 201 };
    }
    assertNoUnknownFields(body, ["assignmentId"]);
    const { error } = await auth.client.rpc("revoke_role_assignment", {
      target_organization_id: auth.organizationId,
      target_assignment_id: uuid(requiredString(body.assignmentId, "assignmentId", 36), "assignmentId", true),
    });
    if (error?.code === "23514") throw new ApiError("LAST_OWNER_PROTECTED", error.message, 409);
    if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have permission to revoke this assignment", 403);
    if (error) throw new ApiError("ASSIGNMENT_REVOKE_FAILED", "Unable to revoke role assignment", 500, undefined, false);
    return { data: { status: "revoked" } };
  },
));
