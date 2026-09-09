import React, { useMemo } from 'react';
import {
  Image,
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
  expression?: { id: string; name: string; avatar_url?: string | null; banner_url?: string | null } | null;
  mode: 'general' | 'expression';
  streams: LiveStream[];
  posts: SocialPost[];
  sermons: Sermon[];
  events: Event[];
  degradedSections?: string[];
};

type QuickLinkProps = {
  label: string;
  hint: string;
  icon: string;
  onPress: () => void;
};

function QuickLink({ label, hint, icon, onPress }: QuickLinkProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quickLink,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        pressed ? { opacity: 0.86, transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon as any} size={19} color={colors.interactive} />
      </View>
      <View style={styles.quickCopy}>
        <Text style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.quickHint, { color: colors.textMuted }]} numberOfLines={1}>{hint}</Text>
      </View>
      <Icon name="chevron-forward" size={15} color={colors.textMuted} />
    </Pressable>
  );
}

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
        <Skeleton height={180} borderRadius={radius.xl} />
        <Skeleton height={78} count={4} />
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
        <View style={[styles.identityBanner, { backgroundColor: colors.primarySoft }]}>
          {expression?.banner_url ? (
            <Image source={{ uri: expression.banner_url }} style={styles.identityBannerImage} resizeMode="cover" />
          ) : (
            <View style={styles.identityBannerFallback}>
              <Icon name="people-circle-outline" size={34} color={colors.interactive} />
            </View>
          )}
        </View>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroAvatar, { backgroundColor: colors.cardElevated, borderColor: colors.card }]}>
            {expression?.avatar_url ? (
              <Image source={{ uri: expression.avatar_url }} style={styles.heroAvatarImage} resizeMode="cover" />
            ) : (
              <Icon name="people" size={28} color={colors.interactive} />
            )}
          </View>
          <View style={[styles.privatePill, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="lock-closed" size={12} color={colors.interactive} />
            <Text style={[styles.privatePillText, { color: colors.textSecondary }]}>Members only</Text>
          </View>
        </View>
        <Text style={[styles.kicker, { color: colors.interactive }]}>YOUR EXPRESSION</Text>
        <Text style={[styles.title, { color: colors.text }]}>{expression?.name ?? 'Your Expression'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          A focused community space for conversations, prayer, gatherings, teaching and live moments shared with this Expression.
        </Text>
        <View style={styles.heroActions}>
          <Pressable
            onPress={() => router.push(`/expressions/${id}/feed` as any)}
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: colors.interactive },
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon name="chatbubbles" size={17} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Open feed</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/general')}
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon name="globe-outline" size={17} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>General COT</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <QuickLink label="Announcements" hint="Important updates" icon="megaphone-outline" onPress={() => router.push(`/expressions/${id}/announcements` as any)} />
        <QuickLink label="Prayer" hint="Pray together" icon="heart-outline" onPress={() => router.push(`/expressions/${id}/prayer` as any)} />
        <QuickLink label="Events" hint="Gatherings" icon="calendar-outline" onPress={() => router.push(`/expressions/${id}/events` as any)} />
        <QuickLink label="Groups" hint="Smaller circles" icon="people-circle-outline" onPress={() => router.push(`/expressions/${id}/groups` as any)} />
        <QuickLink label="Chat" hint="Direct messages" icon="chatbubble-ellipses-outline" onPress={() => router.push(`/expressions/${id}/chat` as any)} />
      </View>

      {resource.data?.degradedSections?.length ? (
        <Pressable
          onPress={resource.refresh}
          style={[styles.notice, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}
        >
          <Icon name="alert-circle-outline" size={17} color={colors.textSecondary} />
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Some Expression sections are still loading. Tap to retry.
          </Text>
          <Icon name="refresh-outline" size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {activeStream ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>LIVE</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Happening in your Expression</Text>
            </View>
            <Pressable onPress={() => router.push(`/expressions/${id}/live` as any)}>
              <Text style={[styles.sectionLink, { color: colors.interactive }]}>See all</Text>
            </Pressable>
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
            <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>COMMUNITY</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>From your people</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Recent conversations inside this Expression</Text>
          </View>
          <Pressable onPress={() => router.push(`/expressions/${id}/feed` as any)}>
            <Text style={[styles.sectionLink, { color: colors.interactive }]}>See all</Text>
          </Pressable>
        </View>
        {posts.length ? (
          <View style={styles.stack}>
            {posts.slice(0, 4).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                expressionName={expression?.name}
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
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>CALENDAR</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Coming up</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Expression gatherings and activities</Text>
            </View>
            <Pressable onPress={() => router.push(`/expressions/${id}/events` as any)}>
              <Text style={[styles.sectionLink, { color: colors.interactive }]}>See all</Text>
            </Pressable>
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
              <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>TEACHING</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent messages</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Teaching selected for this Expression</Text>
            </View>
            <Pressable onPress={() => router.push(`/expressions/${id}/sermons` as any)}>
              <Text style={[styles.sectionLink, { color: colors.interactive }]}>See all</Text>
            </Pressable>
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
        <View style={[styles.boundaryIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="shield-checkmark-outline" size={20} color={colors.interactive} />
        </View>
        <View style={styles.boundaryCopy}>
          <Text style={[styles.boundaryTitle, { color: colors.text }]}>This is a private Expression</Text>
          <Text style={[styles.boundaryText, { color: colors.textSecondary }]}>
            Expression conversations stay in this space. General COT remains the church-wide public experience and is presented separately.
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
    paddingTop: spacing.md,
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
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -84,
    right: -54,
    opacity: 0.9,
  },
  identityBanner: {
    height: 132,
    marginHorizontal: -24,
    marginTop: -24,
    marginBottom: -34,
    overflow: 'hidden',
  },
  identityBannerImage: {
    width: '100%',
    height: '100%',
  },
  identityBannerFallback: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: spacing.lg,
    opacity: 0.75,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  privatePill: {
    minHeight: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  privatePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kicker: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: {
    ...typography.h1,
    maxWidth: 720,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
    maxWidth: 650,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryAction: {
    minHeight: 44,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickGrid: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  quickLink: {
    minHeight: 62,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickHint: {
    fontSize: 10,
    marginTop: 2,
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
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  sectionHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '800',
    paddingBottom: 2,
  },
  stack: {
    gap: spacing.sm,
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
  boundaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.84,
  },
});
