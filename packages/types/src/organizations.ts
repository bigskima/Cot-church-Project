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
  expressions: import("./memberships").ExpressionMembershipContext[];
  creatorOrganizations?: Array<Pick<OrganizationSummary, "id" | "name" | "slug" | "timezone">>;
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

/**
 * Public Ministry Leadership Entity (Decoupled from Login Credentials)
 * Note: Public leadership titles do NOT equate to security roles or RBAC capabilities.
 */
export interface Leader {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  profile_id?: string | null;
  name: string;
  role_title: string;
  biography: string;
  avatar_url?: string | null;
  is_founder: boolean;
  is_historic: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}
