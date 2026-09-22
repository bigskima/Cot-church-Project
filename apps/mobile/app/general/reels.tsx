import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ReelsExperience } from '@/features/media/ReelsExperience';

export default function GeneralReelsScreen() {
  return (
    <View style={styles.screen}>
      <ReelsExperience scope="general" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
