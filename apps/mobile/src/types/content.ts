export type ContentVisibility = 'public' | 'organization' | 'branch' | 'group' | 'private';
export type PublicationStatus = 'draft' | 'processing' | 'review' | 'scheduled' | 'published' | 'archived';
export type ContentItemType = 'post' | 'reel' | 'video' | 'sermon' | 'live_stream';
export type MediaAssetType = 'video' | 'audio' | 'image';
export type MediaProcessingState = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';
export type MediaRenditionKind = 'video_stream' | 'video_download' | 'audio_stream' | 'audio_download' | 'thumbnail' | 'waveform';
export type VideoCategory = 'documentary' | 'conference' | 'worship' | 'interview' | 'testimony' | 'teaching' | 'programme' | 'highlights' | 'podcast' | 'general';
export type CollectionType = 'playlist' | 'series' | 'conference' | 'teaching' | 'worship' | 'featured';

export type MediaRendition = {
  id: string;
  rendition_kind: MediaRenditionKind;
  container: string;
  codec: string;
  width?: number;
  height?: number;
  bitrate?: number;
  storage_path?: string;
  provider_playback_id?: string;
  is_master?: boolean;
};

export type MediaTrack = {
  id: string;
  track_type: 'captions' | 'subtitles' | 'audio_description';
  language: string;
  label?: string;
  storage_path: string;
  is_default?: boolean;
};

export type MediaThumbnail = {
  id?: string;
  storage_path: string;
  width?: number;
  height?: number;
  is_primary?: boolean;
};

export type MediaAsset = {
  id?: string;
  organization_id?: string;
  expression_id?: string | null;
  media_type?: MediaAssetType;
  type?: 'image' | 'video' | 'audio';
  processing_state?: MediaProcessingState;
  source_storage_path?: string;
  duration_seconds?: number | null;
  width?: number;
  height?: number;
  aspect_ratio?: string | null;
  mime_type?: string;
  renditions?: MediaRendition[];
  tracks?: MediaTrack[];
  thumbnails?: MediaThumbnail[];
  url?: string;
  thumbnailUrl?: string;
  alt?: string;
};

export type ContentItem = {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  group_id?: string | null;
  author_profile_id?: string | null;
  content_type: ContentItemType;
  visibility: ContentVisibility;
  status: PublicationStatus;
  published_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type SocialPost = {
  id: string;
  organization_id?: string;
  author_membership_id?: string;
  branch_id?: string | null;
  expression_id?: string | null;
  group_id?: string | null;
  body: string;
  visibility: ContentVisibility;
  media?: MediaAsset[];
  published_at: string;
  social_reactions?: { reaction: string }[];
  content_items?: ContentItem;
};

export type Reel = {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  media_asset_id: string;
  caption: string;
  audio_title?: string | null;
  audio_artist?: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  content_items?: ContentItem;
  media_assets?: MediaAsset;
};

export type Video = {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  media_asset_id: string;
  series_id?: string | null;
  title: string;
  slug: string;
  description: string;
  category: VideoCategory;
  chapters?: { title: string; timestamp_seconds: number }[];
  transcript?: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  content_items?: ContentItem;
  media_assets?: MediaAsset;
};

export type ContentCollectionItem = {
  content_item_id: string;
  item_type: ContentItemType;
  title: string;
  display_order: number;
};

export type ContentCollection = {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  title: string;
  slug: string;
  description: string;
  artwork_url?: string | null;
  collection_type: CollectionType;
  visibility: ContentVisibility;
  status: PublicationStatus;
  items_count?: number;
  items?: ContentCollectionItem[];
  created_at: string;
};

export type Leader = {
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
};

export type Follow = {
  id: string;
  profile_id: string;
  organization_id?: string | null;
  expression_id?: string | null;
  leader_id?: string | null;
  created_at: string;
  organizations?: { id: string; name: string; slug: string };
  branches?: { id: string; name: string; city?: string; state?: string };
  leaders?: Leader;
};

export type ContentComment = {
  id: string;
  content_item_id: string;
  author_profile_id: string;
  parent_comment_id?: string | null;
  body: string;
  created_at: string;
  profiles?: { id: string; display_name: string; avatar_url?: string };
};

export type PlaybackProgress = {
  content_item_id: string;
  profile_id: string;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_played_at: string;
};

export type LiveStream = {
  id: string;
  organization_id?: string;
  expression_id?: string | null;
  branch_id?: string | null;
  title: string;
  description: string;
  status: 'provisioning' | 'ready' | 'scheduled' | 'live' | 'ended' | 'cancelled' | 'failed';
  visibility: ContentVisibility;
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
  
  // Authoritative Asset References
  audio_asset_id?: string | null;
  video_asset_id?: string | null;
  
  // Derived/Read-only Playback URLs
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  
  duration_seconds?: number | null;
  chapters?: { title: string; timestamp_seconds: number }[];
  status: PublicationStatus;
  visibility: ContentVisibility;
  is_featured?: boolean;
  play_count?: number;
  published_at?: string;
  ai_summary?: string | null;
  ai_study?: {
    summary?: string;
    takeaways?: string[];
    review_status?: 'draft' | 'reviewed' | 'approved' | 'rejected';
  } | null;
};

export type GivingCampaign = {
  id: string;
  organization_id?: string;
  expression_id?: string | null;
  branch_id?: string | null;
  name: string;
  description: string;
  currency: string;
  target_amount?: number;
  raised_amount?: number;
  goal_amount_minor?: number;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  starts_at?: string;
  ends_at?: string;
};

export type BankAccount = {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing_number?: string | null;
  currency: string;
  transfer_instructions: string;
  reference_prefix?: string;
  is_public: boolean;
};

export type PublicGivingDetails = {
  campaigns: GivingCampaign[];
  bankAccounts: BankAccount[];
  supportedMethods: string[];
};

export type ChurchOrganization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
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
