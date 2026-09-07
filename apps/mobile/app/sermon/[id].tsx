import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { SermonDetailExperience } from '@/features/media/SermonDetailExperience';
import { useSession } from '@/state/session';

export default function GeneralSermonDetailScreen() {
  const { id, context: requestedContext } = useLocalSearchParams<{ id: string; context?: string }>();
  const { context } = useSession();
  const sermonId = typeof id === 'string' ? id : '';

  if (requestedContext === 'expression' && context?.expression?.id && sermonId) {
    return <Redirect href={`/expressions/${context.expression.id}/sermons/${sermonId}` as any} />;
  }

  return <SermonDetailExperience sermonId={sermonId} scope="general" />;
}
