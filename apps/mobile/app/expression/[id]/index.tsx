import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Avatar,
  Badge,
  Button,
  Chip,
  EmptyState,
  ExpressionSkeleton,
  Icon,
  LeaderCard,
  ReelCard,
  ResourceError,
  ScreenHeader,
  SermonCard,
  VideoCard,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { CampusBranch, Event, LeadershipProfile, Reel, Sermon, Video } from '@/types/content';
import type { Follow } from '@/types/content';

interface ExpressionData {
  expression: CampusBranch;
  sermons: Sermon[];
  videos: Video[];
  reels: Reel[];
  events: Event[];
  leaders: LeadershipProfile[];
  isFollowing?: boolean;
}

export default function ExpressionProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { api, mode, context, enterExpression } = useSession();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'sermons' | 'watch' | 'reels' | 'events' | 'leaders'>('sermons');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followError, setFollowError] = useState('');

  const resource = useResource<ExpressionData>(`expression:profile:${id}`, (signal) => {
    return api.request<ExpressionData>(`public-content?type=expression&expressionId=${encodeURIComponent(id ?? '')}`, { signal });
  });

  const data = resource.data;
  const expression = data?.expression;
  const sermons = data?.sermons ?? [];
  const videos = data?.videos ?? [];
  const reels = data?.reels ?? [];
  const events = data?.events ?? [];
  const leaders = data?.leaders ?? [];
  const membership = context?.expressions?.find((item) => item.id === id && item.status === 'active');

  useEffect(() => {
    if (typeof data?.isFollowing === 'boolean') setIsFollowing(data.isFollowing);
  }, [data?.isFollowing]);

  useEffect(() => {
    if (mode !== 'authenticated' || !id) return;
    let active = true;
    api.request<Follow[]>('follows', { context: 'public' })
      .then((items) => { if (active) setIsFollowing(items.some((item) => item.expression_id === id)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [api, id, mode]);

  const handleToggleFollow = async () => {
    if (mode === 'visitor') {
      router.push('/(auth)/login');
      return;
    }
    setFollowingLoading(true);
    setFollowError('');
    try {
      await api.request('follows', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({
          expressionId: id,
        }),
      });
      setIsFollowing(!isFollowing);
    } catch (value) {
      setFollowError(value instanceof Error ? value.message : 'Unable to update this follow.');
    } finally {
      setFollowingLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="" showBack style={{ backgroundColor: 'transparent' }} />

      {resource.loading ? (
        <ExpressionSkeleton />
      ) : resource.error && !expression ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : expression ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        >
          {/* Header Banner / Identity Section */}
          <View style={styles.headerSection}>
            <View style={[styles.avatarWrap, { borderColor: colors.bg }]}>
              <Avatar name={expression.name} size="xl" />
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.nameRow}>
                <Text style={[styles.title, { color: colors.text }]}>{expression.name}</Text>
                <Badge label={expression.code || 'CAMPUS'} variant="primary" />
              </View>

              {expression.address ? (
                <View style={styles.locationRow}>
                  <Icon name="location-outline" size={14} color={colors.interactive} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                    {expression.address}
                  </Text>
                </View>
              ) : null}

              {/* Follow Button */}
              <Button
                label={isFollowing ? 'Following Campus' : 'Follow Campus'}
                onPress={handleToggleFollow}
                loading={followingLoading}
                variant={isFollowing ? 'outline' : 'primary'}
                size="md"
                style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                icon={<Icon name={isFollowing ? 'checkmark' : 'add'} size={16} color={isFollowing ? colors.interactive : '#FFFFFF'} />}
              />
              {membership ? (
                <Button
                  label={context?.expression?.id === id ? 'Expression Entered' : 'Enter Expression'}
                  onPress={async () => {
                    if (context?.expression?.id === id) return;
                    await enterExpression(membership.organizationId, membership.id);
                    router.replace('/(tabs)/home');
                  }}
                  disabled={context?.expression?.id === id}
                  variant="outline"
                  size="md"
                  style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                />
              ) : mode === 'authenticated' ? (
                <Button label="Join with Invite Code" onPress={() => router.push('/expressions')} variant="outline" size="md" style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
              ) : null}
              {followError ? <Text style={[styles.followError, { color: colors.live }]} accessibilityRole="alert">{followError}</Text> : null}
            </View>
          </View>

          {/* Navigation Filter Tabs */}
          <View style={[styles.tabsBar, { borderBottomColor: colors.borderSubtle }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
              <Chip
                label="Sermons"
                selected={activeTab === 'sermons'}
                onPress={() => setActiveTab('sermons')}
                count={sermons.length}
              />
              <Chip
                label="Videos"
                selected={activeTab === 'watch'}
                onPress={() => setActiveTab('watch')}
                count={videos.length}
              />
              <Chip
                label="Reels"
                selected={activeTab === 'reels'}
                onPress={() => setActiveTab('reels')}
                count={reels.length}
              />
              <Chip
                label="Events"
                selected={activeTab === 'events'}
                onPress={() => setActiveTab('events')}
                count={events.length}
              />
              <Chip
                label="Leadership"
                selected={activeTab === 'leaders'}
                onPress={() => setActiveTab('leaders')}
                count={leaders.length}
              />
            </ScrollView>
          </View>

          {/* Tab Content Display */}
          <View style={styles.tabContentArea}>
            {activeTab === 'sermons' && (
              sermons.length > 0 ? (
                <View style={styles.cardStack}>
                  {sermons.map((s) => (
                    <SermonCard
                      key={s.id}
                      sermon={s}
                      onPress={() => router.push(`/sermon/${s.id}?context=expression` as any)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No Sermons Published"
                  message="This campus expression has not uploaded sermon recordings yet."
                  iconName="book-outline"
                />
              )
            )}

            {activeTab === 'watch' && (
              videos.length > 0 ? (
                <View style={styles.cardStack}>
                  {videos.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      onPress={() => router.push(`/watch/${v.id}` as any)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No Videos in Library"
                  message="Broadcast archives and teachings will appear here."
                  iconName="videocam-outline"
                />
              )
            )}

            {activeTab === 'reels' && (
              reels.length > 0 ? (
                <View style={styles.reelsGrid}>
                  {reels.map((r) => (
                    <ReelCard
                      key={r.id}
                      reel={r}
                      onPress={() => router.push('/reels')}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No Reels Available"
                  message="Short devotional clips will appear here."
                  iconName="film-outline"
                />
              )
            )}

            {activeTab === 'events' && (
              events.length > 0 ? (
                <View style={styles.cardStack}>
                  {events.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => router.push(`/event/${e.id}` as any)}
                      style={[styles.eventTile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                    >
                      <Text style={[styles.eventTitle, { color: colors.text }]}>{e.title}</Text>
                      {e.starts_at ? (
                        <Text style={[styles.eventDate, { color: colors.interactive }]}>
                          {new Date(e.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No Upcoming Events"
                  message="Calendar gatherings for this campus will appear here."
                  iconName="calendar-outline"
                />
              )
            )}

            {activeTab === 'leaders' && (
              leaders.length > 0 ? (
                <View style={styles.cardStack}>
                  {leaders.map((leader) => (
                    <LeaderCard
                      key={leader.id}
                      leader={leader}
                      variant="standard"
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No Leaders Listed"
                  message="Campus pastors and leaders will appear here."
                  iconName="people-outline"
                />
              )
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  avatarWrap: {
    alignSelf: 'flex-start',
  },
  infoBlock: {
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 13,
  },
  followError: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  tabsBar: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  tabsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  tabContentArea: {
    padding: spacing.lg,
  },
  cardStack: {
    gap: spacing.md,
  },
  reelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventTile: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '600',
  },
});
