import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CommunityParticipationExperience } from '@/features/community/CommunityParticipationExperience';
import { PollComposerExperience } from '@/features/community/PollComposerExperience';

export default function ExpressionParticipationScreen() {
  const { expressionId, compose } = useLocalSearchParams<{ expressionId?: string; compose?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  if (compose === 'poll') return <PollComposerExperience scope="expression" expressionId={id} />;
  return <CommunityParticipationExperience scope="expression" expressionId={id} />;
}
