import type { PlatformBrandingConfig } from '@church/types';
import { ApiClient, apiUrl } from '../api';

const DEFAULT_BRANDING: PlatformBrandingConfig = {
  platform_name: 'Church Digital Platform',
  primary_logo_url: null,
  compact_logo_url: null,
  dark_logo_url: null,
  public_header_logo_url: null,
  launch_logo_url: null,
  launch_background_url: null,
  default_placeholder_logo_url: null,
  default_leader_placeholder_url: null,
  theme_tokens: {
    navy: '#091733',
    gold: '#E5B94B',
    cream: '#F4F2EB',
    ink: '#15213A',
  },
};

let cachedBranding: PlatformBrandingConfig | null = null;

export async function fetchPlatformBranding(apiClient?: ApiClient): Promise<PlatformBrandingConfig> {
  if (cachedBranding) return cachedBranding;

  try {
    const client = apiClient ?? new ApiClient(apiUrl, () => null);
    const data = await client.request<PlatformBrandingConfig>('branding');
    if (data) {
      cachedBranding = { ...DEFAULT_BRANDING, ...data };
      return cachedBranding;
    }
  } catch (_err) {
    // Network or remote failure -> gracefully fallback to bundled default branding
  }

  cachedBranding = DEFAULT_BRANDING;
  return cachedBranding;
}

export function getCachedBranding(): PlatformBrandingConfig {
  return cachedBranding ?? DEFAULT_BRANDING;
}
