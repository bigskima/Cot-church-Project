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
    navy: '#0D294B',
    blue: '#2F6FED',
    background: '#F7F9FC',
    ink: '#0B1628',
  },
};

let cachedBranding: PlatformBrandingConfig | null = null;
let inFlightBranding: Promise<PlatformBrandingConfig> | null = null;

async function loadBranding(apiClient?: ApiClient): Promise<PlatformBrandingConfig> {
  try {
    const client = apiClient ?? new ApiClient(apiUrl, () => null);
    const data = await client.request<PlatformBrandingConfig>('branding');
    if (data) {
      cachedBranding = {
        ...DEFAULT_BRANDING,
        ...data,
        theme_tokens: {
          ...DEFAULT_BRANDING.theme_tokens,
          ...(data.theme_tokens ?? {}),
        },
      };
      return cachedBranding;
    }
  } catch {
    // Branding is non-critical bootstrap data. The bundled brand remains usable
    // when the API is offline, misconfigured or temporarily unavailable.
  }

  cachedBranding = DEFAULT_BRANDING;
  return cachedBranding;
}

export function fetchPlatformBranding(apiClient?: ApiClient): Promise<PlatformBrandingConfig> {
  if (cachedBranding) return Promise.resolve(cachedBranding);
  if (inFlightBranding) return inFlightBranding;

  inFlightBranding = loadBranding(apiClient).finally(() => {
    inFlightBranding = null;
  });
  return inFlightBranding;
}

export async function refreshPlatformBranding(apiClient?: ApiClient) {
  cachedBranding = null;
  inFlightBranding = null;
  return fetchPlatformBranding(apiClient);
}

export function getCachedBranding(): PlatformBrandingConfig {
  return cachedBranding ?? DEFAULT_BRANDING;
}
