import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError } from "./errors.ts";
import { bearerToken } from "./request.ts";
import { userClient } from "./supabase.ts";
import { uuid } from "./validation.ts";

export interface AuthContext {
  token: string;
  user: User;
  client: SupabaseClient;
  organizationId: string | null;
  branchId: string | null;
  membershipId: string | null;
}

export async function authenticate(request: Request, requireOrganization: boolean): Promise<AuthContext> {
  const token = bearerToken(request);
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);

  const organizationId = uuid(request.headers.get("x-organization-id"), "organizationId", requireOrganization);
  const branchId = uuid(request.headers.get("x-branch-id"), "branchId");
  if (branchId && !organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required when a branch is selected", 400);

  let membershipId: string | null = null;
  if (organizationId) {
    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("id, branch_id")
      .eq("organization_id", organizationId)
      .eq("profile_id", data.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError || !membership) throw new ApiError("ORGANIZATION_ACCESS_DENIED", "No active membership for this organization", 403);
    if (branchId) {
      const { data: branch } = await client.from("branches").select("id").eq("id", branchId).eq("organization_id", organizationId).maybeSingle();
      if (!branch) throw new ApiError("BRANCH_ACCESS_DENIED", "Branch does not belong to the selected organization", 403);
    }
    membershipId = membership.id;
  }

  return { token, user: data.user, client, organizationId, branchId, membershipId };
}

export async function authorize(context: AuthContext, permission: string) {
  if (!context.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
  const { data, error } = await context.client.rpc("has_permission", {
    target_organization_id: context.organizationId,
    requested_permission: permission,
    target_branch_id: context.branchId,
  });
  if (error || data !== true) throw new ApiError("PERMISSION_DENIED", "You do not have permission to perform this action", 403);
}
