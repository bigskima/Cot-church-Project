export interface OrganizationUnit { id: string; organization_id: string; branch_id: string | null; name: string; description: string; leader_membership_id: string | null; is_active: boolean; }
export interface GroupRecord { id: string; branch_id: string | null; ministry_id: string | null; name: string; description: string; visibility: "members" | "private"; capacity: number | null; meeting_schedule: Record<string, unknown>; is_active: boolean; }
export type GroupMembershipStatus = "requested" | "active" | "declined" | "removed";
export type PrayerVisibility = "private" | "prayer_team" | "organization";
export type PrayerRequestStatus = "submitted" | "in_review" | "praying" | "answered" | "closed";
export interface PrayerRequestRecord { id: string; branch_id: string | null; title: string; body: string; visibility: PrayerVisibility; status: PrayerRequestStatus; answered_testimony: string | null; created_at: string; updated_at: string; }
