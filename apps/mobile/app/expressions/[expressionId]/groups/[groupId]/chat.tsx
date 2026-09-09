import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { GroupChatExperience } from '@/features/chat/GroupChatExperience';

export default function GroupChatRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = typeof groupId === 'string' ? groupId : '';
  if (!id) return null;
  return <GroupChatExperience groupId={id} />;
}
