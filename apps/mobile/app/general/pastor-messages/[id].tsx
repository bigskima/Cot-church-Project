import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PastorMessageDetailExperience from '@/features/media/PastorMessageDetailExperience';

export default function GeneralPastorMessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PastorMessageDetailExperience sermonId={typeof id === 'string' ? id : ''} scope="general" />;
}
