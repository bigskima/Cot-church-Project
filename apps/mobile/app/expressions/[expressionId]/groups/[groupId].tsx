import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionGroupsExperience } from '@/features/expression/ExpressionGroupsExperience';

export default function ExpressionGroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = typeof groupId === 'string' ? groupId : '';
  return <ExpressionGroupsExperience embedded focusGroupId={id} />;
}
