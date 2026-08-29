export type SermonPublishStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';

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

export interface Sermon {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  series_id?: string | null;
  recording_id?: string | null;
  title: string;
  slug: string;
  preacher: string;
  sermon_date: string;
  scripture_references: string[];
  topics: string[];
  description: string;
  transcript?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  status: SermonPublishStatus;
  visibility: 'public' | 'organization' | 'branch' | 'group' | 'private';
  is_featured: boolean;
  play_count: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
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
