import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { GroupSpaceExperience } from '@/features/expression/GroupSpaceExperience';

export default function GroupGivingRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = typeof groupId === 'string' ? groupId : '';
  if (!id) return null;
  return <GroupSpaceExperience groupId={id} initialTab='giving' />;
}
