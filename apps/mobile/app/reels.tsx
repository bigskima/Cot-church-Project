import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ReelsExperience } from '@/features/media/ReelsExperience';
import { useSession } from '@/state/session';

export default function GeneralReelsScreen() {
  const { context: requestedContext, reelId } = useLocalSearchParams<{ context?: string; reelId?: string }>();
  const { context } = useSession();

  if (requestedContext === 'expression' && context?.expression?.id) {
    const suffix = reelId ? `?reelId=${encodeURIComponent(reelId)}` : '';
    return <Redirect href={`/expressions/${context.expression.id}/reels${suffix}` as any} />;
  }

  return <ReelsExperience scope="general" />;
}
