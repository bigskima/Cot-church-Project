import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function GeneralEntryScreen() {
  const { colors } = useTheme();
  const { mode, accessReady, context, leaveExpression } = useSession();
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'restoring') return;
    if (mode === 'authenticated' && !accessReady) return;

    let cancelled = false;

    const enterGeneral = async () => {
      try {
        if (mode === 'authenticated' && context?.expression?.id) {
          await leaveExpression();
        }
        if (!cancelled) router.replace('/(tabs)/home');
      } catch (value) {
        if (!cancelled) {
          setError(value instanceof Error ? value.message : 'Unable to return to General COT.');
        }
      }
    };

    void enterGeneral();
    return () => {
      cancelled = true;
    };
  }, [accessReady, context?.expression?.id, leaveExpression, mode]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        {error ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>We couldn’t open General COT</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>{error}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.interactive} />
            <Text style={[styles.title, { color: colors.text }]}>Opening General COT</Text>
            <Text style={[styles.copy, { color: colors.textSecondary }]}>
              Leaving the private Expression context and returning to the church-wide experience.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  copy: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
