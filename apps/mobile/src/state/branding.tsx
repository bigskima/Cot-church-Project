import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useSession } from './session';
import type { PlatformBrandingConfig } from '@church/types';

interface BrandingContextValue {
  branding: PlatformBrandingConfig | null;
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
  const { api, mode } = useSession();
  const [branding, setBranding] = useState<PlatformBrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const res = await api.request<PlatformBrandingConfig>('branding');
      if (res && typeof res === 'object') {
        setBranding(res);
      }
    } catch {
      // Fallback to local default if remote request fails
      setBranding(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, [mode]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        loading,
        platformName: branding?.platform_name || 'Church of the Truth',
        primaryLogoUrl: branding?.primary_logo_url,
        compactLogoUrl: branding?.compact_logo_url,
        darkLogoUrl: branding?.dark_logo_url,
        launchLogoUrl: branding?.launch_logo_url,
        refresh: fetchBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: null,
      loading: false,
      platformName: 'Church of the Truth',
      primaryLogoUrl: null,
      compactLogoUrl: null,
      darkLogoUrl: null,
      launchLogoUrl: null,
      refresh: async () => {},
    };
  }
  return ctx;
}
