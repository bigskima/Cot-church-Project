export type MediaAsset = { type: 'image' | 'video'; url: string; thumbnailUrl?: string; alt?: string };

export type SocialPost = {
  id: string;
  body: string;
  visibility: 'public' | 'organization' | 'branch' | 'group' | 'private';
  media?: MediaAsset[];
  published_at: string;
  social_reactions?: { reaction: string }[];
};

export type LiveStream = {
  id: string;
  organization_id?: string;
  expression_id?: string | null;
  title: string;
  description: string;
  status: 'provisioning' | 'ready' | 'scheduled' | 'live' | 'ended' | 'cancelled' | 'failed';
  visibility: 'public' | 'organization' | 'branch' | 'group' | 'private';
  scheduled_start?: string;
  started_at?: string;
  ended_at?: string;
  thumbnail_url?: string;
  playback_url?: string;
  viewer_count?: number;
  latency_mode?: string;
  created_at?: string;
};

export type Event = {
  id: string;
  organization_id?: string;
  expression_id?: string | null;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location?: { name?: string; is_online?: boolean };
  visibility: string;
  capacity?: number | null;
};

export type SermonSeries = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  artwork_url?: string | null;
  is_featured?: boolean;
};

export type Sermon = {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  series_id?: string | null;
  series?: SermonSeries | null;
  recording_id?: string | null;
  title: string;
  slug: string;
  preacher: string;
  preacher_name?: string;
  sermon_date: string;
  recorded_at?: string;
  scripture_references: string[];
  topics?: string[];
  description: string;
  transcript?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  status: 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
  visibility: 'public' | 'organization' | 'branch' | 'group' | 'private';
  is_featured?: boolean;
  play_count?: number;
};

export type GivingCampaign = {
  id: string;
  organization_id?: string;
  expression_id?: string | null;
  name: string;
  description: string;
  currency: string;
  target_amount?: number;
  raised_amount?: number;
  goal_amount_minor?: number;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
};

export type Receipt = {
  id: string;
  receipt_number: string;
  amount_minor: number;
  currency: string;
  category?: string;
  issued_at: string;
  created_at: string;
};

export type PrayerRequest = {
  id: string;
  title: string;
  request?: string;
  description?: string;
  privacy: 'pastoral_only' | 'prayer_team' | 'public_approved';
  is_confidential?: boolean;
  is_anonymous?: boolean;
  status: 'submitted' | 'praying' | 'answered' | 'archived';
  prayer_count?: number;
  created_at: string;
};

export type LiveFollowUp = {
  id: string;
  stream_id: string;
  profile_id?: string;
  user_name?: string;
  user_email?: string;
  type: 'prayer_request' | 'altar_response' | 'counselling' | 'membership_interest';
  status: 'new' | 'assigned' | 'contacted' | 'resolved' | 'closed';
  private_note?: string;
  created_at: string;
};

export type MembershipContext = {
  profile: { id: string; display_name: string; email?: string; avatar_url?: string };
  effectivePermissions?: string[];
  organization?: { id: string; name: string; slug: string };
  expression?: { id: string; name: string };
  organizations: {
    id: string;
    name: string;
    slug: string;
    memberships: { id: string; status: string; branch_id?: string }[];
  }[];
};
