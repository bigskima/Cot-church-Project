import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionChatExperience } from '@/features/chat/ExpressionChatExperience';

export default function ExpressionChatRoute() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  return (
    <View style={styles.screen}>
      <ExpressionChatExperience expressionId={id} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
