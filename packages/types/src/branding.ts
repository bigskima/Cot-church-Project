export interface PlatformBrandingConfig {
  id?: string;
  platform_name: string;
  primary_logo_url?: string | null;
  compact_logo_url?: string | null;
  dark_logo_url?: string | null;
  public_header_logo_url?: string | null;
  launch_logo_url?: string | null;
  launch_background_url?: string | null;
  default_placeholder_logo_url?: string | null;
  default_leader_placeholder_url?: string | null;
  theme_tokens?: Record<string, string>;
  updated_at?: string;
}

export interface ChurchStory {
  id: string;
  organization_id: string;
  title: string;
  subtitle: string;
  mission: string;
  vision: string;
  founding_story: string;
  founding_year: number;
  history_milestones: Array<{
    year: number | string;
    title: string;
    description: string;
  }>;
  values: Array<{
    title: string;
    description: string;
  }>;
  banner_image_url?: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadershipProfile {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  expression_name?: string | null;
  profile_id?: string | null;
  display_name: string;
  portrait_url?: string | null;
  role_title: string;
  short_bio: string;
  full_bio: string;
  ministry?: string | null;
  display_order: number;
  tenure_start?: string | null;
  tenure_end?: string | null;
  is_founder: boolean;
  is_featured_public: boolean;
  is_active: boolean;
  social_links?: Record<string, string>;
  created_at: string;
  updated_at: string;
}
