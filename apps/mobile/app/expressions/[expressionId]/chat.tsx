import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionChatExperience } from '@/features/chat/ExpressionChatExperience';

export default function ExpressionChatRoute() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  return <ExpressionChatExperience expressionId={typeof expressionId === 'string' ? expressionId : ''} />;
}
