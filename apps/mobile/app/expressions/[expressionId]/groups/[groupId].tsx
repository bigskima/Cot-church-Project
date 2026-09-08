import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionGroupsExperience } from '@/features/expression/ExpressionGroupsExperience';

export default function ExpressionGroupDetailScreen() {
  const { expressionId, groupId } = useLocalSearchParams<{ expressionId?: string; groupId?: string }>();
  const expression = typeof expressionId === 'string' ? expressionId : '';
  const group = typeof groupId === 'string' ? groupId : '';
  return <ExpressionGroupsExperience embedded expressionId={expression} focusGroupId={group} />;
}
