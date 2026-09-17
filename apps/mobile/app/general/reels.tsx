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
      <View pointerEvents="none" style={[styles.scopeTarget, { top: insets.top + 8 }]}>
        <TourAnchor targetKey="general.reels.scope" style={styles.fill}>
          <View style={styles.fill} />
        </TourAnchor>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Measurement-only tour overlay. pointerEvents="none" is important here: this
  // target sits over the header pill and must never swallow Create/Back touches.
  scopeTarget: { position: 'absolute', left: 64, right: 112, height: 48, zIndex: 5 },
  fill: { flex: 1 },
});
