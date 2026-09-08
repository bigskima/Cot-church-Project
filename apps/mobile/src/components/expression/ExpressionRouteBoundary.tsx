import React, { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button, Icon } from '@/components';
import { radius, spacing, typography } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { toUserFacingErrorMessage } from '@/api';
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
    leaveExpression,
    refreshContext,
  } = useSession();
  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const membership = useMemo(
    () => context?.expressions?.find((item) => item.id === expressionId && item.status === 'active'),
    [context?.expressions, expressionId],
  );

  const activeExpressionId = context?.expression?.id;

  useEffect(() => {
    refreshContext();
  }, [expressionId, refreshContext]);

  useEffect(() => {
    if (
      mode === 'authenticated' &&
      accessReady &&
      activeExpressionId === expressionId &&
      !membership
    ) {
      void leaveExpression().catch(() => {});
    }
  }, [accessReady, activeExpressionId, expressionId, leaveExpression, membership, mode]);

  useEffect(() => {
    if (
      mode !== 'authenticated' ||
      !accessReady ||
      !membership ||
      activeExpressionId === expressionId ||
      syncing ||
      Boolean(syncError)
    ) {
      return;
    }

    let cancelled = false;
    setSyncing(true);
    setSyncError('');

    enterExpression(membership.organizationId, membership.id)
      .catch((value) => {
        if (!cancelled) {
          setSyncError(toUserFacingErrorMessage(value, 'We couldn’t open this Expression. Please try again.'));
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
    syncError,
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
            <Button label="Try again" onPress={() => setSyncError('')} />
            <Button label="My Expressions" variant="outline" onPress={() => router.replace('/expressions')} />
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'restoring' || !accessReady || syncing || (membership && activeExpressionId !== expressionId)) {
    return (
      <View style={[styles.stateScreen, { backgroundColor: colors.bg }]}>
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <ActivityIndicator size="large" color={colors.interactive} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Entering your Expression</Text>
          <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>
            Getting your private community ready.
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
          <Text style={[styles.stateTitle, { color: colors.text }]}>This Expression isn’t available to you</Text>
          <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>
            Join this Expression first, or choose another Expression you’re already part of.
          </Text>
          <View style={styles.actions}>
            <Button label="My Expressions" onPress={() => router.replace('/expressions')} />
            <Button label="General COT" variant="outline" onPress={() => router.replace('/general')} />
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
