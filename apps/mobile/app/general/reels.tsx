import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReelsExperience } from '@/features/media/ReelsExperience';
import { TourAnchor } from '@/features/tour/AppTourProvider';

export default function GeneralReelsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ReelsExperience scope="general" />
      <TourAnchor targetKey="general.reels.scope" style={[styles.scopeTarget, { top: insets.top + 8 }]}>
        <View style={styles.fill} />
      </TourAnchor>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scopeTarget: { position: 'absolute', left: 16, right: 68, height: 44, zIndex: 30 },
  fill: { flex: 1 },
});
