import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
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
}

export function Skeleton({
  height = 20,
  width = '100%',
  borderRadius = radius.md,
  count = 1,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  if (count > 1) {
    return (
      <View style={{ gap: spacing.sm }}>
        {Array.from({ length: count }).map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.skeleton,
              {
                height: height as any,
                width: width as any,
                borderRadius,
                backgroundColor: colors.bgSecondary,
                opacity: opacityAnim,
              },
              style,
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          height: height as any,
          width: width as any,
          borderRadius,
          backgroundColor: colors.bgSecondary,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

export function HomeFeedSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.feedSkeleton}>
      {/* Stories Tray Placeholder */}
      <View style={styles.storiesTraySkeleton}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.storyBubbleSkeleton}>
            <Skeleton height={56} width={56} borderRadius={28} />
            <Skeleton height={10} width={44} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Hero Live Video Placeholder */}
      <View style={{ paddingHorizontal: spacing.md }}>
        <Skeleton height={200} borderRadius={radius.xl} />
      </View>

      {/* YouTube-Style Video Card Placeholder */}
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <Skeleton height={180} borderRadius={radius.md} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Skeleton height={36} width={36} borderRadius={18} />
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton height={14} width="80%" />
            <Skeleton height={12} width="40%" />
          </View>
        </View>
      </View>
    </View>
  );
}

export function CommunityPostSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={[styles.postSkeletonRow, { borderBottomColor: colors.borderSubtle }]}>
          <Skeleton height={40} width={40} borderRadius={20} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Skeleton height={14} width={100} />
              <Skeleton height={14} width={60} />
            </View>
            <Skeleton height={14} width="95%" />
            <Skeleton height={14} width="70%" />
            <View style={{ flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.xs }}>
              <Skeleton height={12} width={24} />
              <Skeleton height={12} width={24} />
              <Skeleton height={12} width={24} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function DiscoverSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      <Skeleton height={44} borderRadius={radius.pill} />
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <Skeleton height={32} width={60} borderRadius={radius.pill} />
        <Skeleton height={32} width={80} borderRadius={radius.pill} />
        <Skeleton height={32} width={70} borderRadius={radius.pill} />
      </View>
      <Skeleton height={120} count={3} borderRadius={radius.xl} />
    </View>
  );
}

export function WatchSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      <Skeleton height={220} width="100%" borderRadius={0} />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <Skeleton height={20} width="85%" />
        <Skeleton height={14} width="40%" />
        <Skeleton height={40} borderRadius={radius.md} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  );
}

export function SermonSkeleton() {
  return (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.md }}>
      <Skeleton height={220} borderRadius={radius.xl} />
      <Skeleton height={22} width="80%" />
      <Skeleton height={14} width="50%" />
      <Skeleton height={80} borderRadius={radius.md} />
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Skeleton height={68} width={68} borderRadius={34} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={18} width="60%" />
          <Skeleton height={14} width="40%" />
        </View>
      </View>
      <Skeleton height={50} count={4} borderRadius={radius.xl} />
    </View>
  );
}

export function ExpressionSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      <Skeleton height={160} width="100%" borderRadius={0} />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <Skeleton height={24} width="70%" />
        <Skeleton height={14} width="45%" />
        <Skeleton height={36} borderRadius={radius.pill} style={{ marginTop: spacing.xs }} />
      </View>
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md, marginTop: spacing.md }}>
        <Skeleton height={100} count={3} borderRadius={radius.xl} />
      </View>
    </View>
  );
}

export function CommentsSkeleton() {
  return (
    <View style={{ gap: spacing.md, padding: spacing.md }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton height={32} width={32} borderRadius={16} />
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton height={12} width={80} />
            <Skeleton height={14} width="90%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ReelLoadingSkeleton() {
  return (
    <View style={styles.reelSkeleton}>
      <Skeleton height="100%" width="100%" borderRadius={0} />
      <View style={styles.reelSkeletonOverlay}>
        <View style={{ flex: 1, justifyContent: 'flex-end', gap: spacing.xs, paddingBottom: 60 }}>
          <Skeleton height={16} width={140} />
          <Skeleton height={14} width="80%" />
        </View>
        <View style={{ gap: spacing.md, alignItems: 'center', paddingBottom: 60 }}>
          <Skeleton height={40} width={40} borderRadius={20} />
          <Skeleton height={40} width={40} borderRadius={20} />
          <Skeleton height={40} width={40} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  message: string;
  iconName?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
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
          borderColor: colors.borderSubtle,
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
          variant="secondary"
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
          label="Try again"
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
  feedSkeleton: {
    gap: spacing.lg,
  },
  storiesTraySkeleton: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  storyBubbleSkeleton: {
    alignItems: 'center',
    gap: 4,
  },
  postSkeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  reelSkeleton: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  reelSkeletonOverlay: {
    ...StyleSheet.absoluteFill as any,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  errorContainer: {
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
