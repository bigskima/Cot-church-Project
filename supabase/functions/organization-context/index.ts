import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";

type MembershipRow = {
  id: string;
  status: string;
  joined_at: string | null;
  branch_id: string | null;
  organization: { id: string; name: string; slug: string; status: string; timezone: string } | null;
  branch: { id: string; name: string; code: string; timezone: string; is_active: boolean } | null;
};

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "required", organization: "optional" },
  async ({ auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    const [membershipsResult, profileResult] = await Promise.all([
      auth.client
        .from("memberships")
        .select("id, status, joined_at, branch_id, organization:organizations(id, name, slug, status, timezone), branch:branches(id, name, code, timezone, is_active)")
        .eq("profile_id", auth.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      auth.client
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle(),
    ]);

    if (membershipsResult.error) {
      throw new ApiError("CONTEXT_LOOKUP_FAILED", "Unable to resolve organization context", 500, undefined, false);
    }
    if (profileResult.error) {
      throw new ApiError("CONTEXT_LOOKUP_FAILED", "Unable to resolve member profile", 500, undefined, false);
    }

    const memberships = (membershipsResult.data ?? []) as unknown as MembershipRow[];

    let effectivePermissions: string[] = [];
    if (auth.organizationId && auth.membershipId) {
      const { data: assignments, error: permissionError } = await auth.client
        .from("role_assignments")
        .select("branch_id, expires_at, role:roles(role_permissions(permission:permissions(code, is_active)))")
        .eq("membership_id", auth.membershipId)
        .or(`branch_id.is.null,branch_id.eq.${auth.branchId ?? "00000000-0000-0000-0000-000000000000"}`);
      if (permissionError) {
        throw new ApiError("CONTEXT_LOOKUP_FAILED", "Unable to resolve permissions", 500, undefined, false);
      }
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

    const organizationMap = new Map<string, {
      id: string;
      name: string;
      slug: string;
      timezone: string;
      memberships: Array<{ id: string; status: string; branch_id: string | null }>;
    }>();

    for (const membership of memberships) {
      if (!membership.organization || membership.organization.status !== "active") continue;
      const current = organizationMap.get(membership.organization.id) ?? {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        timezone: membership.organization.timezone,
        memberships: [],
      };
      // Keep organisation membership available for General Community, but never
      // advertise a disabled Expression as selectable/current context.
      current.memberships.push({
        id: membership.id,
        status: membership.status,
        branch_id: membership.branch?.is_active ? membership.branch_id : null,
      });
      organizationMap.set(current.id, current);
    }

    const organizations = [...organizationMap.values()];
    const selectedMembership =
      memberships.find((membership) => membership.organization?.id === auth.organizationId) ??
      memberships[0] ??
      null;
    const selectedOrganization = selectedMembership?.organization?.status === "active"
      ? selectedMembership.organization
      : null;

    const requestedExpression = auth.branchId
      ? memberships.find((membership) => membership.branch?.id === auth.branchId)?.branch ?? null
      : selectedMembership?.branch ?? null;
    const selectedExpression = requestedExpression?.is_active ? requestedExpression : null;

    return {
      data: {
        userId: auth.user.id,
        selectedOrganizationId: selectedOrganization?.id ?? null,
        selectedBranchId: selectedExpression?.id ?? null,
        profile: {
          id: profileResult.data?.id ?? auth.user.id,
          display_name: profileResult.data?.display_name ?? auth.user.email?.split("@")[0] ?? "Member",
          email: auth.user.email ?? undefined,
          avatar_url: profileResult.data?.avatar_url ?? undefined,
        },
        organization: selectedOrganization
          ? {
              id: selectedOrganization.id,
              name: selectedOrganization.name,
              slug: selectedOrganization.slug,
            }
          : undefined,
        expression: selectedExpression
          ? {
              id: selectedExpression.id,
              name: selectedExpression.name,
            }
          : undefined,
        organizations,
        memberships,
        effectivePermissions,
      },
    };
  },
));
