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

export type OrganizationContextMode = "required" | "optional" | "none";

export async function authenticate(request: Request, organizationMode: OrganizationContextMode = "optional"): Promise<AuthContext> {
  const token = bearerToken(request);
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);

  // Handlers that explicitly declare organization:"none" are global/account
  // workflows. Ignore stale organisation/expression headers completely so a
  // previously selected context can never make profile/auth/public-account
  // operations depend on membership.
  const organizationId = organizationMode === "none"
    ? null
    : uuid(request.headers.get("x-organization-id"), "organizationId", organizationMode === "required");
  const branchId = organizationMode === "none"
    ? null
    : uuid(request.headers.get("x-branch-id"), "branchId");
  if (branchId && !organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required when an expression is selected", 400);

  let membershipId: string | null = null;
  if (organizationId) {
    let membershipQuery = client
      .from("memberships")
      .select("id, branch_id")
      .eq("organization_id", organizationId)
      .eq("profile_id", data.user.id)
      .eq("status", "active");

    const { data: membership, error: membershipError } = await membershipQuery
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError || !membership) {
      throw new ApiError("ORGANIZATION_ACCESS_DENIED", "No active membership for this organization context", 403);
    }

    const { data: organization, error: organizationError } = await client
      .from("organizations")
      .select("id,status")
      .eq("id", organizationId)
      .maybeSingle();
    if (organizationError || !organization) {
      throw new ApiError("ORGANIZATION_ACCESS_DENIED", "Organization is unavailable", 403);
    }
    if (organization.status !== "active") {
      throw new ApiError("ORGANIZATION_UNAVAILABLE", "This church organization is currently unavailable on the platform", 403);
    }

    if (branchId) {
      const [{ data: branch, error: branchError }, { data: expressionMembership, error: expressionMembershipError }] = await Promise.all([
        client.from("branches").select("id,is_active").eq("id", branchId).eq("organization_id", organizationId).maybeSingle(),
        client.from("expression_memberships").select("id,status").eq("organization_id", organizationId).eq("branch_id", branchId).eq("profile_id", data.user.id).eq("status", "active").maybeSingle(),
      ]);
      if (branchError || !branch) throw new ApiError("BRANCH_ACCESS_DENIED", "Expression does not belong to the selected organization", 403);
      if (!branch.is_active) {
        throw new ApiError("EXPRESSION_UNAVAILABLE", "This expression is currently unavailable on the platform", 403);
      }
      if (expressionMembershipError || !expressionMembership) {
        throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED", "Active membership in this Expression is required", 403);
      }
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

export async function authorizeOrganization(context: AuthContext, permission: string) {
  if (!context.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
  const { data, error } = await context.client.rpc("has_permission", {
    target_organization_id: context.organizationId,
    requested_permission: permission,
    target_branch_id: null,
  });
  if (error || data !== true) {
    throw new ApiError("PERMISSION_DENIED", "You do not have permission to perform this church-wide action", 403);
  }
}

export async function authorizePlatform(context: AuthContext, permission: string) {
  if (!permission.startsWith("platform.")) {
    throw new ApiError("INVALID_PLATFORM_PERMISSION", "Platform authorization requires a platform-scoped capability", 500, undefined, false);
  }
  const { data, error } = await context.client.rpc("has_platform_permission", {
    requested_permission: permission,
  });
  if (error || data !== true) {
    throw new ApiError("PLATFORM_PERMISSION_DENIED", "You do not have permission to perform this platform action", 403);
  }
}
