import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EnhancedSermonDetailExperience } from '@/features/media/EnhancedSermonDetailExperience';

export default function ExpressionPastorMessageDetailScreen() {
  const { messageId } = useLocalSearchParams<{ messageId?: string }>();
  return <EnhancedSermonDetailExperience sermonId={typeof messageId === 'string' ? messageId : ''} scope="expression" pastorMessage />;
}
