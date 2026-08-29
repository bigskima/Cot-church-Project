export type SermonPublishStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
export type ContentItemType = 'post' | 'reel' | 'video' | 'sermon' | 'live_stream';
export type PublicationStatus = 'draft' | 'processing' | 'review' | 'scheduled' | 'published' | 'archived';
export type MediaAssetType = 'video' | 'audio' | 'image';
export type MediaProcessingState = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';
export type MediaRenditionKind = 'video_stream' | 'video_download' | 'audio_stream' | 'audio_download' | 'thumbnail' | 'waveform';
export type VideoCategory = 'documentary' | 'conference' | 'worship' | 'interview' | 'testimony' | 'teaching' | 'programme' | 'highlights' | 'podcast' | 'general';
export type MediaSourceType = 'uploaded' | 'provider' | 'external';
export type CollectionType = 'playlist' | 'series' | 'conference' | 'teaching' | 'worship' | 'featured';

export interface MediaRendition {
  id: string;
  rendition_kind: MediaRenditionKind;
  container: string;
  codec: string;
  width?: number | null;
  height?: number | null;
  bitrate_bps?: number | null;
  file_size_bytes?: number | null;
  storage_path?: string | null;
  provider_playback_id?: string | null;
  is_master: boolean;
}

export interface MediaTrack {
  id: string;
  track_type: 'captions' | 'subtitles' | 'audio_description';
  language: string;
  label: string;
  storage_path: string;
  is_default: boolean;
}

export interface MediaThumbnail {
  id: string;
  storage_path: string;
  width?: number | null;
  height?: number | null;
  is_primary: boolean;
}

export interface MediaAsset {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  media_type: MediaAssetType;
  source_type: MediaSourceType;
  processing_state: MediaProcessingState;
  source_storage_path?: string | null;
  external_provider?: string | null;
  external_reference?: string | null;
  canonical_external_url?: string | null;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  aspect_ratio?: string | null;
  mime_type: string;
  file_size_bytes?: number | null;
  provider: string;
  provider_asset_id?: string | null;
  processing_error?: string | null;
  metadata: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  renditions?: MediaRendition[];
  tracks?: MediaTrack[];
  thumbnails?: MediaThumbnail[];
}

export interface ContentChapter {
  title: string;
  timestamp_seconds: number;
}

export interface SermonSeries {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  title: string;
  slug: string;
  description: string;
  artwork_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentCollectionItem {
  content_item_id: string;
  item_type: ContentItemType;
  title: string;
  display_order: number;
}

export interface ContentCollection {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  title: string;
  slug: string;
  description: string;
  artwork_url?: string | null;
  collection_type: CollectionType;
  visibility: 'public' | 'organization' | 'branch' | 'group' | 'private';
  status: PublicationStatus;
  items_count?: number;
  items?: ContentCollectionItem[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Authoritative Sermon Model
 * Note: audio_asset_id and video_asset_id are the authoritative persisted references.
 * audio_url and video_url are derived/read-only playback fields resolved at runtime by the API.
 */
export interface Sermon {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  series_id?: string | null;
  series?: SermonSeries | null;
  recording_id?: string | null;
  content_item_id?: string | null;
  title: string;
  slug: string;
  preacher: string;
  sermon_date: string;
  scripture_references: string[];
  topics: string[];
  description: string;
  transcript?: string | null;
  chapters?: ContentChapter[];
  
  // Authoritative Persisted Asset References
  audio_asset_id?: string | null;
  video_asset_id?: string | null;
  
  // Derived/Read-only Playback URLs (API resolved)
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  
  duration_seconds?: number | null;
  status: SermonPublishStatus;
  visibility: 'public' | 'organization' | 'branch' | 'group' | 'private';
  is_featured: boolean;
  play_count: number;
  ai_summary?: string | null;
  ai_study?: {
    summary?: string;
    takeaways?: string[];
    review_status?: 'draft' | 'reviewed' | 'approved' | 'rejected';
  } | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  media_asset_id: string;
  series_id?: string | null;
  title: string;
  slug: string;
  description: string;
  category: VideoCategory;
  chapters: ContentChapter[];
  transcript?: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
  media_assets?: MediaAsset;
}

export interface Reel {
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
  updated_at: string;
  media_assets?: MediaAsset;
}

export interface Devotional {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  sermon_id?: string | null;
  title: string;
  scripture: string;
  content: string;
  publish_date: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}
