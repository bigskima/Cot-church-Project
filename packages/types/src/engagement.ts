export type VolunteerApplicationStatus = "applied" | "approved" | "declined" | "withdrawn";
export type VolunteerScheduleStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export interface VolunteerOpportunity { id: string; branch_id: string | null; ministry_id: string | null; title: string; description: string; starts_at: string | null; ends_at: string | null; capacity: number | null; is_active: boolean; }
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "cancelled" | "archived";
export type DeliveryChannel = "in_app" | "email" | "sms" | "push";
export interface Announcement { id: string; branch_id: string | null; title: string; body: string; status: AnnouncementStatus; audience: Record<string, unknown>; channels: DeliveryChannel[]; scheduled_for: string | null; published_at: string | null; }
export interface NotificationPreferences { emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean; quietHours: Record<string, unknown>; }

export type ContentReactionType = 'like' | 'love' | 'pray' | 'celebrate' | 'amen' | 'support';

export interface ContentReaction {
  content_item_id: string;
  profile_id: string;
  reaction: ContentReactionType;
  created_at: string;
}

export interface ContentComment {
  id: string;
  content_item_id: string;
  author_profile_id: string;
  parent_comment_id?: string | null;
  body: string;
  is_hidden?: boolean;
  created_at: string;
  updated_at?: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
  replies?: ContentComment[];
}

export interface ContentBookmark {
  content_item_id: string;
  profile_id: string;
  created_at: string;
}

export interface PlaybackProgress {
  content_item_id: string;
  profile_id: string;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_played_at: string;
}

export interface Follow {
  id: string;
  profile_id: string;
  organization_id?: string | null;
  expression_id?: string | null;
  leader_id?: string | null;
  created_at: string;
  organizations?: { id: string; name: string; slug: string };
  branches?: { id: string; name: string; city?: string; state?: string };
  leaders?: { id: string; name: string; role_title: string; avatar_url?: string | null };
}

export interface ContentModerationReport {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  content_item_id?: string | null;
  comment_id?: string | null;
  reporter_profile_id: string;
  reason: string;
  details: string;
  status: 'pending' | 'under_review' | 'actioned' | 'dismissed';
  action_taken?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
}
