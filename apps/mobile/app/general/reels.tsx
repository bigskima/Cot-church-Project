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
  // The tour anchor is measurement-only. Keep it below the live Reel header so it
  // never steals taps from Create, Back or other header actions on native builds.
  scopeTarget: { position: 'absolute', left: 64, right: 112, height: 48, zIndex: 5 },
  fill: { flex: 1 },
});
