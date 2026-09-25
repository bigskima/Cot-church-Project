import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PastorMessageDetailExperience from '@/features/media/PastorMessageDetailExperience';

export default function ExpressionPastorMessageDetailScreen() {
  const { messageId } = useLocalSearchParams<{ messageId?: string }>();
  return <PastorMessageDetailExperience sermonId={typeof messageId === 'string' ? messageId : ''} scope="expression" />;
}
