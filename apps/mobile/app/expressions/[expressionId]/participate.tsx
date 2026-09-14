import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CommunityParticipationExperience } from '@/features/community/CommunityParticipationExperience';

export default function ExpressionParticipationScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  return <CommunityParticipationExperience scope="expression" expressionId={id} />;
}
