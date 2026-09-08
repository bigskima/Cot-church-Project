import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/primitives/Icon';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function GeneralLayout() {
  const { colors } = useTheme();
  const { mode, accessReady, context, leaveExpression } = useSession();
  const [leaving, setLeaving] = useState(false);
  const [boundaryError, setBoundaryError] = useState('');

  useEffect(() => {
    if (mode !== 'authenticated' || !accessReady || !context?.expression?.id || leaving) return;

    let cancelled = false;
    setLeaving(true);
    setBoundaryError('');

    void leaveExpression()
      .catch(() => {
        if (!cancelled) setBoundaryError('We couldn’t open General COT. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLeaving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessReady, context?.expression?.id, leaveExpression, leaving, mode]);

  if (mode === 'restoring' || (mode === 'authenticated' && !accessReady) || context?.expression?.id) {
    return (
      <View style={[styles.boundaryScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.boundaryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          {boundaryError ? (
            <>
              <Icon name="alert-circle-outline" size={26} color={colors.live} />
              <Text style={[styles.boundaryTitle, { color: colors.text }]}>General COT is unavailable</Text>
              <Text style={[styles.boundaryCopy, { color: colors.textSecondary }]}>{boundaryError}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.interactive} />
              <Text style={[styles.boundaryTitle, { color: colors.text }]}>Opening General COT</Text>
              <Text style={[styles.boundaryCopy, { color: colors.textSecondary }]}>Getting the church-wide experience ready.</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

const styles = StyleSheet.create({
  boundaryScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  boundaryCard: {
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  boundaryTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  boundaryCopy: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
