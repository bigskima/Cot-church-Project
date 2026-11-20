import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { WatchDetailExperience } from '@/features/media/WatchDetailExperience';

export default function GeneralWatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <WatchDetailExperience videoId={typeof id === 'string' ? id : ''} scope="general" />;
}
