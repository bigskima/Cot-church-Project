import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function Index() {
  const { mode, accessReady, context } = useSession();
  const { colors } = useTheme();

  if (mode === 'restoring' || (mode === 'authenticated' && !accessReady)) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.interactive} />
      </View>
    );
  }

  // Preserve a deliberately active private Expression across app restart.
  // General COT remains the default only when no Expression context is active.
  if (mode === 'authenticated' && context?.expression?.id) {
    return <Redirect href={`/expressions/${context.expression.id}` as any} />;
  }

  return <Redirect href="/general" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
