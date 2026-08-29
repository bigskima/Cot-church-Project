import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing } from '../design-system/tokens';
import { Button } from './Button';

export function Skeleton({
  height = 90,
  width = '100%',
  borderRadius = radius.md,
  dark = false,
  count = 1,
}: {
  height?: number | string;
  width?: number | string;
  borderRadius?: number;
  dark?: boolean;
  count?: number;
}) {
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
                backgroundColor: dark ? palette.surfaceDarkElevated : '#E5E9F0',
              },
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
          backgroundColor: dark ? palette.surfaceDarkElevated : '#E5E9F0',
        },
      ]}
    />
  );
}

export function SkeletonCardList({ count = 3, dark = false }: { count?: number; dark?: boolean }) {
  return (
    <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.skeletonCard,
            { backgroundColor: dark ? palette.surfaceDark : palette.surface },
          ]}
        >
          <Skeleton height={20} width="60%" dark={dark} />
          <Skeleton height={14} width="90%" dark={dark} />
          <Skeleton height={14} width="40%" dark={dark} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = '✦',
  dark = false,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        styles.emptyContainer,
        { backgroundColor: dark ? palette.surfaceDark : palette.surface },
      ]}
    >
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: dark ? palette.surfaceDarkElevated : palette.surfaceSubtle },
        ]}
      >
        <Text style={styles.emptyIconText}>{icon}</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: dark ? palette.white : palette.ink }]}>
        {title}
      </Text>
      <Text style={[styles.emptyMessage, { color: dark ? palette.mutedLight : palette.muted }]}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <View style={styles.emptyActionWrapper}>
          <Button label={actionLabel} onPress={onAction} variant={dark ? 'gold' : 'primary'} size="sm" />
        </View>
      )}
    </View>
  );
}

export function ResourceError({
  message,
  retry,
  offline = false,
  dark = false,
}: {
  message: string;
  retry?: () => void;
  offline?: boolean;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        styles.errorContainer,
        { backgroundColor: dark ? '#2A1215' : '#FFF1F2', borderColor: dark ? '#5C1D24' : '#FECDD3' },
      ]}
    >
      <Text style={styles.errorIcon}>{offline ? '📡' : '⚠️'}</Text>
      <Text style={[styles.errorTitle, { color: dark ? '#FECDD3' : '#9F1239' }]}>
        {offline ? 'Connection Unavailable' : 'Unable to Load Data'}
      </Text>
      <Text style={[styles.errorMessage, { color: dark ? '#F43F5E' : '#BE123C' }]}>
        {message}
      </Text>
      {retry && (
        <View style={styles.retryWrapper}>
          <Button label="Try Again" onPress={retry} variant="outline" size="sm" />
        </View>
      )}
    </View>
  );
}

export function LoadingSpinner({
  message = 'Loading...',
  dark = false,
}: {
  message?: string;
  dark?: boolean;
}) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={palette.gold} />
      <Text style={[styles.loadingText, { color: dark ? palette.mutedLight : palette.muted }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    marginBottom: spacing.xs,
  },
  skeletonCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyActionWrapper: {
    marginTop: spacing.lg,
  },
  errorContainer: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  errorIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  errorMessage: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  retryWrapper: {
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.md,
  },
});
