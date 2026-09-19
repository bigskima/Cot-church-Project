import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GroupChatExperience } from '@/features/chat/GroupChatExperience';

export default function GeneralGroupChatRoute() {
  const { groupId, sectionId } = useLocalSearchParams<{ groupId: string; sectionId?: string }>();
  const id = typeof groupId === 'string' ? groupId : '';
  if (!id) return null;
  return (
    <View
      style={{ flex: 1 }}
      accessibilityLabel="This conversation belongs to a General COT Group and is visible only to its active members."
    >
      <GroupChatExperience groupId={id} sectionId={typeof sectionId === 'string' ? sectionId : null} scope="general" />
    </View>
  );
}
