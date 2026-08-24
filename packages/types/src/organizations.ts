export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  timezone: string;
}

export interface BranchSummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
}

export interface OrganizationMembershipContext {
  id: string;
  status: "active";
  joined_at: string | null;
  branch_id: string | null;
  organization: OrganizationSummary;
  branch: BranchSummary | null;
}

export interface OrganizationContextResponse {
  userId: string;
  selectedOrganizationId: string | null;
  selectedBranchId: string | null;
  memberships: OrganizationMembershipContext[];
  effectivePermissions: string[];
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  timezone?: string;
  initialBranchName?: string;
  initialBranchCode?: string;
}

export interface CreateOrganizationResponse {
  organization_id: string;
  branch_id: string;
  membership_id: string;
}

export interface BranchRecord extends BranchSummary {
  parent_branch_id: string | null;
  address: Record<string, unknown>;
  is_active: boolean;
}

export interface CreateBranchRequest {
  name: string;
  code: string;
  timezone?: string;
  parentBranchId?: string;
  address?: Record<string, unknown>;
}
