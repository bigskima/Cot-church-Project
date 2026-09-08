import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionGroupsExperience } from '@/features/expression/ExpressionGroupsExperience';

export default function ExpressionGroupsScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  return <ExpressionGroupsExperience embedded expressionId={id} />;
}
