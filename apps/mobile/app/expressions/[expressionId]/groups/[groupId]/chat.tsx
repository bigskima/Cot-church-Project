import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GroupChatExperience } from '@/features/chat/GroupChatExperience';

export default function GroupChatRoute() {
  const { groupId, sectionId } = useLocalSearchParams<{ groupId: string; sectionId?: string }>();
  const id = typeof groupId === 'string' ? groupId : '';
  if (!id) return null;
  return (
    <View
      style={{ flex: 1 }}
      accessibilityLabel="Direct chat is global. Group chat is separate and remains inside this Group."
    >
      <GroupChatExperience groupId={id} sectionId={typeof sectionId === 'string' ? sectionId : null} />
    </View>
  );
}
