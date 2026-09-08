import React, { useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  EmptyState,
  EventCard,
  HeroLiveCard,
  Icon,
  PostCard,
  ResourceError,
  SermonCard,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Event, LiveStream, Sermon, SocialPost } from '@/types/content';

type ExpressionHomePayload = {
  organization: { id: string; name: string; slug?: string };
  expression?: { id: string; name: string } | null;
  mode: 'general' | 'expression';
  streams: LiveStream[];
  posts: SocialPost[];
  sermons: Sermon[];
  events: Event[];
  degradedSections?: string[];
};

export default function ExpressionHomeScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { api, context, mode } = useSession();
  const { colors } = useTheme();

  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');
  const organizationId = membership?.organizationId ?? context?.organization?.id ?? '';

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (id) params.set('expressionId', id);
    return `home-feed?${params.toString()}`;
  }, [id, organizationId]);

  const resource = useResource<ExpressionHomePayload>(
    `expression:workspace-home:${organizationId || 'none'}:${id || 'none'}:${mode}`,
    (signal) => api.request<ExpressionHomePayload>(query, { signal }),
  );

  const expression = resource.data?.expression
    ?? (context?.expression?.id === id ? context.expression : undefined)
    ?? membership;
  const streams = resource.data?.streams ?? [];
  const posts = resource.data?.posts ?? [];
  const sermons = resource.data?.sermons ?? [];
  const events = resource.data?.events ?? [];
  const activeStream = streams.find((item) => item.status === 'live')
    ?? streams.find((item) => item.status === 'scheduled');

  if (resource.loading && !resource.data) {
    return (
      <View style={[styles.stateWrap, { backgroundColor: colors.bg }]}>
        <Skeleton height={150} borderRadius={radius.xl} />
        <Skeleton height={92} count={3} />
      </View>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <View style={[styles.stateWrap, { backgroundColor: colors.bg }]}>
        <ResourceError message={resource.error} retry={resource.refresh} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={resource.refreshing}
          onRefresh={resource.refresh}
          tintColor={colors.interactive}
        />
      }
    >
      <View
        style={[
          styles.hero,
          { backgroundColor: colors.card, borderColor: colors.borderSubtle },
          shadows.md,
        ]}
      >
        <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: colors.primarySoft }]} />
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
            <Icon name="people" size={23} color={colors.interactive} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.kicker, { color: colors.interactive }]}>YOUR PRIVATE COMMUNITY</Text>
            <Text style={[styles.title, { color: colors.text }]}>{expression?.name ?? 'Your Expression'}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Everything happening in this Expression, together in one place.
            </Text>
          </View>
          <View style={[styles.privateBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="lock-closed" size={11} color={colors.textMuted} />
            <Text style={[styles.privateBadgeText, { color: colors.textMuted }]}>PRIVATE</Text>
          </View>
        </View>

        <View style={[styles.pulseRow, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.pulseItem}>
            <Text style={[styles.pulseValue, { color: colors.text }]}>{posts.length}</Text>
            <Text style={[styles.pulseLabel, { color: colors.textMuted }]}>Posts</Text>
          </View>
          <View style={[styles.pulseDivider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.pulseItem}>
            <Text style={[styles.pulseValue, { color: colors.text }]}>{events.length}</Text>
            <Text style={[styles.pulseLabel, { color: colors.textMuted }]}>Events</Text>
          </View>
          <View style={[styles.pulseDivider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.pulseItem}>
            <Text style={[styles.pulseValue, { color: activeStream?.status === 'live' ? colors.live : colors.text }]}>{activeStream?.status === 'live' ? 'LIVE' : sermons.length}</Text>
            <Text style={[styles.pulseLabel, { color: colors.textMuted }]}>{activeStream?.status === 'live' ? 'Now' : 'Teachings'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickRow}>
        {[
          { key: 'feed', label: 'Feed', icon: 'chatbubbles-outline', route: `/expressions/${id}/feed` },
          { key: 'groups', label: 'Groups', icon: 'people-circle-outline', route: `/expressions/${id}/groups` },
          { key: 'live', label: 'Live', icon: 'radio-outline', route: `/expressions/${id}/live` },
          { key: 'events', label: 'Events', icon: 'calendar-outline', route: `/expressions/${id}/events` },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [
              styles.quickAction,
              { backgroundColor: colors.card, borderColor: colors.borderSubtle },
              pressed && styles.quickPressed,
            ]}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name={item.icon as any} size={18} color={colors.interactive} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {resource.data?.degradedSections?.length ? (
        <View style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="alert-circle-outline" size={17} color={colors.textSecondary} />
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Some Expression sections are still loading. Pull down to refresh.
          </Text>
        </View>
      ) : null}

      {activeStream ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Live in this Expression</Text>
          </View>
          <HeroLiveCard
            stream={activeStream}
            onPress={() => router.push(`/expressions/${id}/live/${activeStream.id}` as any)}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Community feed</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Recent conversations in this Expression</Text>
          </View>
          <Pressable onPress={() => router.push(`/expressions/${id}/feed` as any)} style={styles.sectionLink}>
            <Text style={[styles.sectionLinkText, { color: colors.interactive }]}>See all</Text>
            <Icon name="chevron-forward" size={14} color={colors.interactive} />
          </Pressable>
        </View>
        {posts.length ? (
          <View style={styles.stack}>
            {posts.slice(0, 4).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                canEngage={mode === 'authenticated'}
                allowExternalShare={false}
                onPress={() => router.push({
                  pathname: `/expressions/${id}/post/[id]`,
                  params: { id: post.id },
                } as any)}
                onReply={() => router.push({
                  pathname: `/expressions/${id}/post/[id]`,
                  params: { id: post.id, focus: 'comments' },
                } as any)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No Expression posts yet"
            message="Member and leadership updates published inside this Expression will appear here."
            iconName="chatbubbles-outline"
          />
        )}
      </View>

      {events.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Expression gatherings and activities</Text>
            </View>
          </View>
          <View style={styles.stack}>
            {events.slice(0, 3).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/expressions/${id}/event/${event.id}` as any)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {sermons.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent teachings</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Media published for this Expression</Text>
            </View>
          </View>
          <View style={styles.stack}>
            {sermons.slice(0, 3).map((sermon) => (
              <SermonCard
                key={sermon.id}
                sermon={sermon}
                onPress={() => router.push(`/expressions/${id}/sermons/${sermon.id}` as any)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.boundaryCard, { borderTopColor: colors.borderSubtle }]}>
        <Icon name="lock-closed-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.boundaryText, { color: colors.textMuted }]}>
          Content here stays inside {expression?.name ?? 'this Expression'} unless it is intentionally shared to General COT.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  stateWrap: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xl,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -90,
    top: -125,
    opacity: 0.9,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    ...typography.h1,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    maxWidth: 600,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  privateBadgeText: { fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 0.7 },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pulseItem: { flex: 1, alignItems: 'center' },
  pulseValue: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.3 },
  pulseLabel: { fontSize: 9.5, lineHeight: 13, fontWeight: '700', marginTop: 1 },
  pulseDivider: { width: 1, height: 24 },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  quickPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  notice: {
    marginTop: spacing.md,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6 },
  sectionLinkText: { fontSize: 11, fontWeight: '800' },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  sectionHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  stack: {
    gap: spacing.md,
  },
  boundaryCard: {
    marginTop: spacing.xxl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boundaryText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
  },
});
