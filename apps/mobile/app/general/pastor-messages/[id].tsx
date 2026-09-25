import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EnhancedSermonDetailExperience } from '@/features/media/EnhancedSermonDetailExperience';

export default function GeneralPastorMessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <EnhancedSermonDetailExperience sermonId={typeof id === 'string' ? id : ''} scope="general" pastorMessage />;
}
