import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "required", organization: "optional" },
  async ({ auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    const { data: memberships, error } = await auth.client
      .from("memberships")
      .select("id, status, joined_at, branch_id, organization:organizations(id, name, slug, status, timezone), branch:branches(id, name, code, timezone)")
      .eq("profile_id", auth.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (error) throw new ApiError("CONTEXT_LOOKUP_FAILED", "Unable to resolve organization context", 500, undefined, false);

    let effectivePermissions: string[] = [];
    if (auth.organizationId && auth.membershipId) {
      const { data: assignments, error: permissionError } = await auth.client
        .from("role_assignments")
        .select("branch_id, expires_at, role:roles(role_permissions(permission:permissions(code, is_active)))")
        .eq("membership_id", auth.membershipId)
        .or(`branch_id.is.null,branch_id.eq.${auth.branchId ?? "00000000-0000-0000-0000-000000000000"}`);
      if (permissionError) throw new ApiError("CONTEXT_LOOKUP_FAILED", "Unable to resolve permissions", 500, undefined, false);
      const now = Date.now();
      effectivePermissions = [...new Set((assignments ?? [])
        .filter((assignment) => !assignment.expires_at || Date.parse(assignment.expires_at) > now)
        .flatMap((assignment) => {
          const role = assignment.role as unknown as { role_permissions?: Array<{ permission?: { code?: string; is_active?: boolean } }> };
          return (role?.role_permissions ?? [])
            .filter((entry) => entry.permission?.is_active && entry.permission.code)
            .map((entry) => entry.permission!.code!);
        }))].sort();
    }

    return {
      data: {
        userId: auth.user.id,
        selectedOrganizationId: auth.organizationId,
        selectedBranchId: auth.branchId,
        memberships: memberships ?? [],
        effectivePermissions,
      },
    };
  },
));
