import React from 'react';
import { router, usePathname } from 'expo-router';
import { useSession } from '@/state/session';

type OnboardingStatus = {
  active: boolean;
  experience: { id: string } | null;
  progress: { completedAt?: string | null } | null;
};

function safeReturnPath(pathname: string) {
  if (!pathname || pathname.includes('login') || pathname.includes('signup') || pathname.includes('onboarding')) {
    return '/(tabs)/home';
  }
  return pathname;
}

export function OnboardingGate() {
  const { mode, auth, api } = useSession();
  const pathname = usePathname();
  const checkedToken = React.useRef<string | null>(null);
  const accessToken = auth?.session.accessToken ?? null;

  React.useEffect(() => {
    if (mode !== 'authenticated' || !accessToken) {
      checkedToken.current = null;
      return;
    }
    if (pathname.includes('onboarding') || checkedToken.current === accessToken) return;

    let cancelled = false;
    checkedToken.current = accessToken;

    void api
      .request<OnboardingStatus>('onboarding', { context: 'public' })
      .then((status) => {
        if (cancelled) return;
        if (status.active && status.experience && !status.progress?.completedAt) {
          router.replace({
            pathname: '/onboarding',
            params: { returnTo: safeReturnPath(pathname) },
          } as any);
        }
      })
      .catch(() => {
        if (!cancelled) checkedToken.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [mode, accessToken, api, pathname]);

  return null;
}
