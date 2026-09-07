import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { LivePlayerExperience } from '@/features/live/LivePlayerExperience';
import { useSession } from '@/state/session';

export default function GeneralLivePlayerScreen() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const { context } = useSession();
  const streamId = typeof id === 'string' ? id : '';

  if (requestedContext === 'expression' && context?.expression?.id && streamId) {
    return <Redirect href={`/expressions/${context.expression.id}/live/${streamId}` as any} />;
  }

  return <LivePlayerExperience streamId={streamId} scope="general" />;
}
