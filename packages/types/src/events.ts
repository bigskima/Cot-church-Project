export type EventStatus = "draft" | "published" | "cancelled" | "completed" | "archived";
export type RegistrationStatus = "registered" | "waitlisted" | "cancelled" | "attended";

export interface EventRecord { id: string; branch_id: string | null; title: string; description: string; status: EventStatus; visibility: "members" | "public" | "private"; location: Record<string, unknown>; timezone: string; starts_at: string; ends_at: string; capacity: number | null; recurrence_rule: Record<string, unknown> | null; }
export interface CreateEventRequest { branchId?: string; title: string; description?: string; visibility?: "members" | "public" | "private"; location?: Record<string, unknown>; timezone?: string; startsAt: string; endsAt: string; registrationOpensAt?: string; registrationClosesAt?: string; capacity?: number; recurrenceRule?: Record<string, unknown>; }
export interface EventRegistrationRecord { id: string; event_id: string; occurrence_id: string | null; status: RegistrationStatus; registered_at: string; }
export interface AttendanceRecord { id: string; event_id: string; occurrence_id: string | null; membership_id: string; checked_in_at: string; checked_in_by: string; notes: string; }
