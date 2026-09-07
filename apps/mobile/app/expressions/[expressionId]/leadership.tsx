import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionLeadershipExperience } from '@/features/expression/ExpressionLeadershipExperience';

export default function ExpressionLeadershipScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  return <ExpressionLeadershipExperience embedded expressionId={id} />;
}
