import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GlobalChatExperience } from '@/features/chat/GlobalChatExperience';

export default function GeneralChatScreen() {
  return (
    <View style={styles.screen}>
      <GlobalChatExperience />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
