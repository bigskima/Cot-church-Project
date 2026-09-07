import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { WatchDetailExperience } from '@/features/media/WatchDetailExperience';
import { useSession } from '@/state/session';

export default function GeneralWatchDetailScreen() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const { context } = useSession();
  const videoId = typeof id === 'string' ? id : '';

  if (requestedContext === 'expression' && context?.expression?.id && videoId) {
    return <Redirect href={`/expressions/${context.expression.id}/videos/${videoId}` as any} />;
  }

  return <WatchDetailExperience videoId={videoId} scope="general" />;
}
