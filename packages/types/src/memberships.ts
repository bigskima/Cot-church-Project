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
