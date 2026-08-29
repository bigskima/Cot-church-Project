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
                backgroundColor: dark ? '#2E1C11' : '#EAD9C8',
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
          backgroundColor: dark ? '#2E1C11' : '#EAD9C8',
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
            {
              backgroundColor: dark ? '#22140C' : palette.surface,
              borderColor: dark ? '#452A1A' : '#E8D5C4',
            },
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
  icon = '🕊️',
  actionLabel,
  onAction,
  dark = false,
}: {
  title: string;
  message: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        styles.emptyContainer,
        {
          backgroundColor: dark ? '#22140C' : palette.surface,
          borderColor: dark ? '#452A1A' : '#E8D5C4',
        },
      ]}
    >
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: dark ? '#FFFDF9' : '#26140A' }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: dark ? '#A68A75' : '#8C6549' }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="outline"
          size="sm"
          style={{ marginTop: spacing.md } as any}
        />
      ) : null}
    </View>
  );
}

export function ResourceError({
  message,
  retry,
  offline = false,
  dark = false,
}: {
  message?: string;
  retry?: () => void;
  offline?: boolean;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        styles.errorContainer,
        {
          backgroundColor: dark ? '#22140C' : palette.surface,
          borderColor: dark ? '#452A1A' : '#E8D5C4',
        },
      ]}
    >
      <Text style={styles.errorIcon}>{offline ? '📶' : '⚠️'}</Text>
      <Text style={[styles.errorTitle, { color: dark ? '#FFFDF9' : '#26140A' }]}>
        {offline ? 'You are currently offline' : 'Unable to load content'}
      </Text>
      <Text style={[styles.errorMessage, { color: dark ? '#A68A75' : '#8C6549' }]}>
        {message || 'Please check your connection and tap retry.'}
      </Text>
      {retry ? (
        <Button
          label="Retry ↺"
          onPress={retry}
          variant="gold"
          size="sm"
          style={{ marginTop: spacing.md } as any}
        />
      ) : null}
    </View>
  );
}

export function LoadingSpinner({
  label = 'Loading sanctuary stream...',
  dark = false,
}: {
  label?: string;
  dark?: boolean;
}) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#F59E0B" />
      <Text style={[styles.loadingLabel, { color: dark ? '#A68A75' : '#8C6549' }]}>{label}</Text>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
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
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyMessage: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  errorContainer: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
  },
});
