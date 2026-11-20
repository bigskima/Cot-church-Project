import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SermonDetailExperience } from '@/features/media/SermonDetailExperience';

export default function ExpressionSermonDetailScreen() {
  const { sermonId } = useLocalSearchParams<{ sermonId: string }>();
  const id = typeof sermonId === 'string' ? sermonId : '';
  return <SermonDetailExperience sermonId={id} scope="expression" />;
}
