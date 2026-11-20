export type MembershipStatus = "invited" | "active" | "inactive" | "suspended";

export interface MembershipRecord {
  id: string;
  status: MembershipStatus;
  joined_at: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  profile: { id: string; display_name: string; phone_number: string | null; avatar_url: string | null };
  branch: { id: string; name: string; code: string } | null;
}

export interface UpdateMembershipRequest {
  membershipId: string;
  status: MembershipStatus;
  branchId: string | null;
}

export type ExpressionMembershipStatus = "invited" | "active" | "suspended" | "left";

export interface ExpressionMembershipRecord {
  id: string;
  organization_id: string;
  branch_id: string;
  membership_id: string;
  profile_id: string;
  status: ExpressionMembershipStatus;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpressionMembershipContext {
  membershipId: string;
  organizationId: string;
  id: string;
  name: string;
  code: string;
  timezone: string;
  status: ExpressionMembershipStatus;
  joinedAt: string | null;
}

export interface ExpressionInviteCodeMetadata {
  id: string;
  code_hint: string;
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  created_at: string;
  revoked_at: string | null;
}
