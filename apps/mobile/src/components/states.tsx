import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing, typography } from '@/design-system/tokens';
import { Button } from './Button';
import { Icon } from './primitives/Icon';

export interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  borderRadius?: number;
  count?: number;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // kept for backwards compatibility
}

export function Skeleton({
  height = 20,
  width = '100%',
  borderRadius = radius.md,
  count = 1,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();

  if (count > 1) {
    return (
      <View style={{ gap: spacing.sm }}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.skeleton,
              {
                height: height as any,
                width: width as any,
                borderRadius,
                backgroundColor: colors.bgSecondary,
              },
              style,
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.skeleton,
        {
          height: height as any,
          width: width as any,
          borderRadius,
          backgroundColor: colors.bgSecondary,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCardList({
  count = 3,
  cardHeight = 100,
}: {
  count?: number;
  cardHeight?: number;
  dark?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Skeleton height={20} width="60%" />
          <Skeleton height={14} width="90%" />
          <Skeleton height={14} width="40%" />
        </View>
      ))}
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  message: string;
  iconName?: string;
  icon?: string; // backwards compatibility
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function EmptyState({
  title,
  message,
  iconName = 'albums-outline',
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.emptyContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.bgSecondary }]}>
        <Icon name={iconName} size={28} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="outline"
          size="sm"
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </View>
  );
}

export interface ResourceErrorProps {
  message?: string;
  retry?: () => void;
  offline?: boolean;
  style?: StyleProp<ViewStyle>;
  dark?: boolean; // backwards compatibility
}

export function ResourceError({
  message,
  retry,
  offline = false,
  style,
}: ResourceErrorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.errorContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.bgSecondary }]}>
        <Icon
          name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={28}
          color={offline ? colors.textMuted : colors.live}
        />
      </View>
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        {offline ? 'You are currently offline' : 'Unable to load content'}
      </Text>
      <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
        {message || 'Please check your internet connection and try again.'}
      </Text>
      {retry ? (
        <Button
          label="Try Again"
          onPress={retry}
          variant="primary"
          size="sm"
          style={{ marginTop: spacing.md }}
          icon={<Icon name="refresh" size={14} color={colors.textInverse} />}
        />
      ) : null}
    </View>
  );
}

export function LoadingSpinner({
  label,
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.loadingContainer, style]}>
      <ActivityIndicator size="large" color={colors.interactive} />
      {label ? (
        <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  skeletonCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  errorContainer: {
    padding: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 300,
  },
  errorTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  errorMessage: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 300,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    ...typography.bodySmall,
    marginTop: spacing.md,
  },
});
