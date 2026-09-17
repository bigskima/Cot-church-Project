import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import PlatformAdministrationModuleExperience from '@/features/platform/PlatformAdministrationModule';
import { usePlatformAdministrationContext } from '@/features/platform/usePlatformAdministration';
import { useTheme } from '@/state/theme';

export default function PlatformAdministrationModuleRoute() {
  const authority = usePlatformAdministrationContext();
  const { colors } = useTheme();
  if (authority.loading) {
    return <View style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.interactive} /></View>;
  }
  return <PlatformAdministrationModuleExperience />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
