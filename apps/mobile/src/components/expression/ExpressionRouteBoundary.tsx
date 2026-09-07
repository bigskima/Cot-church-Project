import React, { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button, Icon } from '@/components';
import { radius, spacing, typography } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Props = PropsWithChildren<{
  expressionId: string;
}>;

export function ExpressionRouteBoundary({ expressionId, children }: Props) {
  const { colors } = useTheme();
  const {
    mode,
    accessReady,
    context,
    enterExpression,
  } = useSession();
  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const membership = useMemo(
    () => context?.expressions?.find((item) => item.id === expressionId && item.status === 'active'),
    [context?.expressions, expressionId],
  );

  const activeExpressionId = context?.expression?.id;

  useEffect(() => {
    if (
      mode !== 'authenticated' ||
      !accessReady ||
      !membership ||
      activeExpressionId === expressionId ||
      syncing
    ) {
      return;
    }

    let cancelled = false;
    setSyncing(true);
    setSyncError('');

    enterExpression(membership.organizationId, membership.id)
      .catch((value) => {
        if (!cancelled) {
          setSyncError(value instanceof Error ? value.message : 'Unable to enter this Expression.');
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accessReady,
    activeExpressionId,
    enterExpression,
    expressionId,
    membership,
    mode,
    syncing,
  ]);

  if (mode === 'visitor') {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/login',
          params: { returnTo: `/expressions/${expressionId}` },
        } as any}
      />
    );
  }

  if (mode === 'restoring' || !accessReady || syncing || (membership && activeExpressionId !== expressionId)) {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <ActivityIndicator size="large" color={colors.interactive} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Entering your Expression</Text>
          <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>
            COT is loading the exact membership, roles and private space for this Expression.
          </Text>
        </View>
      </View>
    );
  }

  if (!membership) {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="lock-closed-outline" size={24} color={colors.interactive} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>This Expression is not in your memberships</Text>
          <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>
            Private Expression routes are bound to the Expression ID in the URL. Join this Expression first, or choose one you already belong to.
          </Text>
          <View style={styles.actions}>
            <Button label="My Expressions" onPress={() => router.replace('/expressions')} />
            <Button label="General COT" variant="outline" onPress={() => router.replace('/general')} />
          </View>
        </View>
      </View>
    );
  }

  if (syncError) {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="alert-circle-outline" size={24} color={colors.interactive} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>We couldn’t open this Expression</Text>
          <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>{syncError}</Text>
          <View style={styles.actions}>
            <Button
              label="Try again"
              onPress={() => {
                setSyncError('');
                setSyncing(false);
              }}
            />
            <Button label="My Expressions" variant="outline" onPress={() => router.replace('/expressions')} />
          </View>
        </View>
      </View>
    );
  }

  if (activeExpressionId !== expressionId) return null;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateCard: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stateTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  stateCopy: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 370,
  },
  actions: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
