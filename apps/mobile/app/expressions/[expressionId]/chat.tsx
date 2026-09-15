import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ExpressionChatExperience } from '@/features/chat/ExpressionChatExperience';
import { TourAnchor } from '@/features/tour/AppTourProvider';

export default function ExpressionChatRoute() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  return (
    <View style={styles.screen}>
      <ExpressionChatExperience expressionId={id} />
      <TourAnchor targetKey="expression.discussion.header" style={styles.headerTarget}>
        <View style={styles.fill} />
      </TourAnchor>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerTarget: { position: 'absolute', left: 12, right: 12, top: 8, height: 116, zIndex: 30 },
  fill: { flex: 1 },
});
