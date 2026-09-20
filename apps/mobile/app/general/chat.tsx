import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalChatExperience } from '@/features/chat/GlobalChatExperience';
import { TourAnchor } from '@/features/tour/AppTourProvider';

export default function GeneralChatScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <GlobalChatExperience />
      <View pointerEvents="none" style={[styles.headerTarget, { top: insets.top }]}>
        <TourAnchor targetKey="general.messages.header" style={styles.fill}>
          <View style={styles.fill} />
        </TourAnchor>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerTarget: { position: 'absolute', left: 12, right: 12, height: 78, zIndex: 30 },
  fill: { flex: 1 },
});
