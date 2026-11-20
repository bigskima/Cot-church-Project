import React, { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useSession } from './session';
import type { PlatformBrandingConfig } from '@church/types';
import {
  fetchPlatformBranding,
  getCachedBranding,
  refreshPlatformBranding,
} from '@/services/branding';

interface BrandingContextValue {
  branding: PlatformBrandingConfig;
  loading: boolean;
  platformName: string;
  primaryLogoUrl?: string | null;
  compactLogoUrl?: string | null;
  darkLogoUrl?: string | null;
  launchLogoUrl?: string | null;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: PropsWithChildren) {
  const { api } = useSession();
  const [branding, setBranding] = useState<PlatformBrandingConfig>(() => getCachedBranding());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBranding(await fetchPlatformBranding(api));
    } finally {
      setLoading(false);
    }
  }, [api]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBranding(await refreshPlatformBranding(api));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        loading,
        platformName: branding.platform_name || 'Church Digital Platform',
        primaryLogoUrl: branding.primary_logo_url,
        compactLogoUrl: branding.compact_logo_url,
        darkLogoUrl: branding.dark_logo_url,
        launchLogoUrl: branding.launch_logo_url,
        refresh,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (ctx) return ctx;

  const fallback = getCachedBranding();
  return {
    branding: fallback,
    loading: false,
    platformName: fallback.platform_name || 'Church Digital Platform',
    primaryLogoUrl: fallback.primary_logo_url,
    compactLogoUrl: fallback.compact_logo_url,
    darkLogoUrl: fallback.dark_logo_url,
    launchLogoUrl: fallback.launch_logo_url,
    refresh: async () => {},
  };
}
