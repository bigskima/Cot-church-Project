import React, { useMemo } from 'react';
import {
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
        <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="home-outline" size={22} color={colors.interactive} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.kicker, { color: colors.interactive }]}>EXPRESSION HOME</Text>
          <Text style={[styles.title, { color: colors.text }]}>{expression?.name ?? 'Your Expression'}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your private community home. General COT content stays outside this space unless it is deliberately published here.
          </Text>
        </View>
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
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Recent posts inside this Expression</Text>
          </View>
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
                  pathname: '/post/[id]',
                  params: { id: post.id, scope: 'expression' },
                } as any)}
                onReply={() => router.push({
                  pathname: '/post/[id]',
                  params: { id: post.id, scope: 'expression', focus: 'comments' },
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
                onPress={() => router.push(`/event/${event.id}?context=expression` as any)}
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

      <View style={[styles.boundaryCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <Icon name="shield-checkmark-outline" size={20} color={colors.interactive} />
        <View style={styles.boundaryCopy}>
          <Text style={[styles.boundaryTitle, { color: colors.text }]}>Expression boundary active</Text>
          <Text style={[styles.boundaryText, { color: colors.textSecondary }]}>
            This workspace is tied to the Expression ID in the route and your active membership. Returning to General COT exits the private Expression context.
          </Text>
        </View>
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
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
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
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
    maxWidth: 650,
  },
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
  },
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
    marginTop: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  boundaryCopy: {
    flex: 1,
  },
  boundaryTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  boundaryText: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },
});
