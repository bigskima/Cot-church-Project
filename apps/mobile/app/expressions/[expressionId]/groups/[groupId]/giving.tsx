import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { GroupGivingExperience } from '@/features/expression/GroupGivingExperience';

export default function GroupGivingRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = typeof groupId === 'string' ? groupId : '';
  if (!id) return null;
  return <GroupGivingExperience groupId={id} />;
}
