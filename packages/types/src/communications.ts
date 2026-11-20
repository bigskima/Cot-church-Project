export type ConversationType="direct"|"group"|"ministry"|"support";
export interface Conversation{ id:string; branch_id:string|null; type:ConversationType; title:string|null; created_by:string; created_at:string; updated_at:string; }
export interface Message{ id:string; conversation_id:string; sender_membership_id:string; body:string; status:"sent"|"edited"|"redacted"; reply_to_id:string|null; sent_at:string; }
export interface NotificationInboxItem{ id:string; type:string; title:string; body:string; data:Record<string,unknown>; read_at:string|null; created_at:string; }
export interface NotificationOutboxJob{ id:number; organization_id:string; recipient_profile_id:string|null; channel:"email"|"sms"|"push"; payload:Record<string,unknown>; attempts:number; }
