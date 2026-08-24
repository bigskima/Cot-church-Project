export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";
export type CreateMembershipInvitation = { email:string; phoneNumber?:never; branchId?:string; validityHours?:number } | { email?:never; phoneNumber:string; branchId?:string; validityHours?:number };
export interface MembershipInvitation { id:string; branch_id:string|null; invited_email:string|null; invited_phone:string|null; status:InvitationStatus; expires_at:string; accepted_at:string|null; created_at:string; updated_at:string; }
