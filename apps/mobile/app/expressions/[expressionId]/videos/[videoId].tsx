import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { WatchDetailExperience } from '@/features/media/WatchDetailExperience';

export default function ExpressionVideoDetailScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const id = typeof videoId === 'string' ? videoId : '';
  return <WatchDetailExperience videoId={id} scope="expression" />;
}
