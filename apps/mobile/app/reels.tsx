import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyReelsRoute() {
  const { context, reelId } = useLocalSearchParams<{ context?: string; reelId?: string }>();
  if (context === 'expression') return <Redirect href="/expressions" />;
  return (
    <Redirect
      href={{
        pathname: '/general/reels',
        params: reelId ? { reelId } : {},
      } as any}
    />
  );
}
