export type VolunteerApplicationStatus = "applied" | "approved" | "declined" | "withdrawn";
export type VolunteerScheduleStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export interface VolunteerOpportunity { id:string; branch_id:string|null; ministry_id:string|null; title:string; description:string; starts_at:string|null; ends_at:string|null; capacity:number|null; is_active:boolean; }
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "cancelled" | "archived";
export type DeliveryChannel = "in_app" | "email" | "sms" | "push";
export interface Announcement { id:string; branch_id:string|null; title:string; body:string; status:AnnouncementStatus; audience:Record<string,unknown>; channels:DeliveryChannel[]; scheduled_for:string|null; published_at:string|null; }
export interface NotificationPreferences { emailEnabled:boolean; smsEnabled:boolean; pushEnabled:boolean; quietHours:Record<string,unknown>; }
