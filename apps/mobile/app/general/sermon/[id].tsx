import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SermonDetailExperience } from '@/features/media/SermonDetailExperience';

export default function GeneralSermonDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <SermonDetailExperience sermonId={typeof id === 'string' ? id : ''} scope="general" />;
}
