import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LivePlayerExperience } from '@/features/live/LivePlayerExperience';

export default function ExpressionLivePlayerScreen() {
  const { streamId } = useLocalSearchParams<{ streamId: string }>();
  const id = typeof streamId === 'string' ? streamId : '';
  return <LivePlayerExperience streamId={id} scope="expression" embedded />;
}
