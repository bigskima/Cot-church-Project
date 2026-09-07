import React, { type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

type Props = PropsWithChildren<{
  ready: boolean;
  allowed: boolean;
  title: string;
  expressionId: string;
  message?: string;
}>;

export function ExpressionManagementGate({
  ready,
  allowed,
  title,
  expressionId,
  message = 'This tool isn’t available for your account in this Expression.',
  children,
}: Props) {
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={[styles.state, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.interactive} />
        <Text style={[styles.title, { color: colors.text }]}>Checking your ministry tools</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          Making sure this tool is available for you in this Expression.
        </Text>
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={[styles.state, { backgroundColor: colors.bg }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="lock-closed-outline" size={24} color={colors.interactive} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{message}</Text>
        <View style={styles.actions}>
          <Button label="Expression Home" onPress={() => router.replace(`/expressions/${expressionId}` as any)} />
          <Button label="Back to tools" variant="outline" onPress={() => router.replace(`/expressions/${expressionId}/manage` as any)} />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  copy: {
    maxWidth: 420,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
