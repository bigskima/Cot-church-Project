import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, LeaderCard, ResourceError, Skeleton, ScreenHeader } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { LeadershipProfile } from '@church/types';

export default function ExpressionLeadershipScreen() {
  const { api, auth } = useSession();
  const { colors, isDark } = useTheme();
  const branchId = auth?.branchId;

  const leadersResource = useResource<LeadershipProfile[]>(`expression:leadership:${branchId}`, (signal) =>
    api.request(`church-story?view=leadership${branchId ? `&expressionId=${branchId}` : ''}`, { signal })
  );

  const leaders = leadersResource.data ?? [];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Expression Leadership"
        subtitle="Pastors, directors, and coordinators serving this local sanctuary campus."
        showBack
        dark={isDark}
      />

      <View style={styles.body}>
        {leadersResource.loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={100} dark={isDark} />
            <Skeleton height={100} dark={isDark} />
          </View>
        ) : leadersResource.error && !leadersResource.data ? (
          <ResourceError
            offline={leadersResource.offline}
            message={leadersResource.error}
            retry={leadersResource.refresh}
            dark={isDark}
          />
        ) : leaders.length > 0 ? (
          leaders.map((leader) => (
            <LeaderCard
              key={leader.id}
              leader={leader}
              variant="standard"
              dark={isDark}
            />
          ))
        ) : (
          <EmptyState
            title="No Campus Leaders Registered"
            message="Expression leadership directory will appear here once assigned by campus leadership."
            icon="👥"
            dark={isDark}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  leaderCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  leaderRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  portrait: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '900',
    color: '#140C07',
  },
  leaderName: {
    fontSize: 17,
    fontWeight: '900',
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.yellowDark,
    marginTop: 2,
  },
  ministryText: {
    fontSize: 11,
    marginTop: 2,
  },
  bioText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});
