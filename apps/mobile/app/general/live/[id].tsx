import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LivePlayerExperience } from '@/features/live/LivePlayerExperience';

export default function GeneralLivePlayerScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <LivePlayerExperience streamId={typeof id === 'string' ? id : ''} scope="general" />;
}
