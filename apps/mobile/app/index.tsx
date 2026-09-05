import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function Index() {
  const { mode } = useSession();
  const { colors } = useTheme();

  if (mode === 'restoring') {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.interactive} />
      </View>
    );
  }

  // Public COT content is the default app entry. Authentication is requested
  // only when a visitor attempts a protected interaction or member operation.
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
