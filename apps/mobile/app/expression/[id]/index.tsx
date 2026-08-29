import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, LeaderCard, ReelCard, SermonCard, VideoCard } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Leader, Reel, Sermon, Video } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function ExpressionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'overview' | 'watch' | 'reels' | 'sermons' | 'leadership'>('overview');
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch Expression Sermons
  const sermonsResource = useResource<Sermon[]>(`exp:sermons:${id}`, (signal) =>
    api.request<Sermon[]>(`public-content?type=sermons&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal })
  );

  // Fetch Expression Videos
  const videosResource = useResource<Video[]>(`exp:videos:${id}`, (signal) =>
    api.request<Video[]>(`public-content?type=videos&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal })
  );

  // Fetch Expression Reels
  const reelsResource = useResource<Reel[]>(`exp:reels:${id}`, (signal) =>
    api.request<Reel[]>(`public-content?type=reels&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal })
  );

  // Fetch Expression Leaders
  const leadersResource = useResource<Leader[]>(`exp:leaders:${id}`, (signal) =>
    api.request<Leader[]>(`public-content?type=leaders&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal })
  );

  const sermons = sermonsResource.data ?? [];
  const videos = videosResource.data ?? [];
  const reels = reelsResource.data ?? [];
  const leaders = leadersResource.data ?? [];

  const handleToggleFollow = async () => {
    if (mode === 'visitor') return;
    try {
      await api.request('follows', {
        method: 'POST',
        body: JSON.stringify({ expressionId: id, organizationId: organization }),
      });
      setIsFollowing(!isFollowing);
    } catch {
      // Ignored
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }] as any}>
      {/* Top Header */}
      <View
        style={[
          styles.navBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ] as any}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn as any}>
          <Text style={[styles.backText, { color: colors.text }] as any}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }] as any} numberOfLines={1}>
          Campus Expression
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content as any}>
        {/* Expression Identity Banner */}
        <View
          style={[
            styles.bannerCard,
            { backgroundColor: isDark ? '#1C1008' : '#FFFDF9', borderColor: isDark ? '#3D2415' : palette.line },
            shadows.md,
          ] as any}
        >
          <View style={styles.bannerRow as any}>
            <View style={styles.logoCircle as any}>
              <Text style={{ fontSize: 24 } as any}>🏛️</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.expressionTitle, { color: colors.text }] as any}>
                Sanctuary Expression
              </Text>
              <Text style={[styles.expressionSub, { color: palette.gold }] as any}>
                Active Worship & Ministry Community
              </Text>
            </View>
            <Pressable
              onPress={handleToggleFollow}
              style={[
                styles.followPill,
                isFollowing ? styles.followingPill : null,
              ] as any}
            >
              <Text style={[styles.followText, isFollowing ? styles.followingText : null] as any}>
                {isFollowing ? '✓ Following' : '+ Follow'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tab Navigation */}
        <View
          style={[
            styles.tabRow,
            { backgroundColor: isDark ? '#1C1008' : '#E8D5C4' },
          ] as any}
        >
          {(['overview', 'watch', 'reels', 'sermons', 'leadership'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabPill,
                  isSelected ? {
                    backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                    ...shadows.sm,
                  } : null,
                ] as any}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isSelected ? colors.text : colors.textMuted },
                    isSelected ? styles.tabTextActive : null,
                  ] as any}
                >
                  {tab === 'overview'
                    ? 'Overview'
                    : tab === 'watch'
                    ? '📹 Watch'
                    : tab === 'reels'
                    ? '🎬 Reels'
                    : tab === 'sermons'
                    ? '🎙️ Sermons'
                    : '👥 Leaders'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tab Panes */}
        {activeTab === 'overview' && (
          <View style={{ gap: spacing.lg }}>
            {/* Reels Carousel */}
            {reels.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.text }] as any}>
                  Featured Short Highlights
                </Text>
                <FlatList
                  horizontal
                  data={reels}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10 }}
                  renderItem={({ item }) => (
                    <ReelCard reel={item} onPress={() => router.push('/(tabs)/reels')} />
                  )}
                />
              </View>
            ) : null}

            {/* Latest Watch Videos */}
            {videos.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.text }] as any}>
                  Latest Watch Broadcasts
                </Text>
                {videos.slice(0, 3).map((item) => (
                  <VideoCard
                    key={item.id}
                    video={item}
                    onPress={() => router.push(`/watch/${item.id}` as any)}
                    dark={isDark}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}

        {activeTab === 'watch' && (
          <View style={{ gap: spacing.md }}>
            {videos.length > 0 ? (
              videos.map((item) => (
                <VideoCard
                  key={item.id}
                  video={item}
                  onPress={() => router.push(`/watch/${item.id}` as any)}
                  dark={isDark}
                />
              ))
            ) : (
              <EmptyState title="No Videos Yet" message="Watch broadcasts will appear here." icon="📹" dark={isDark} />
            )}
          </View>
        )}

        {activeTab === 'reels' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {reels.length > 0 ? (
              reels.map((item) => (
                <ReelCard
                  key={item.id}
                  reel={item}
                  onPress={() => router.push('/(tabs)/reels')}
                  width={110}
                />
              ))
            ) : (
              <EmptyState title="No Reels Yet" message="Short reels will appear here." icon="🎬" dark={isDark} />
            )}
          </View>
        )}

        {activeTab === 'sermons' && (
          <View style={{ gap: spacing.md }}>
            {sermons.length > 0 ? (
              sermons.map((item) => (
                <SermonCard
                  key={item.id}
                  sermon={item}
                  onPress={() => router.push(`/(tabs)/discover/sermon/${item.id}` as any)}
                />
              ))
            ) : (
              <EmptyState title="No Sermons Yet" message="Expository teachings will appear here." icon="🎙️" dark={isDark} />
            )}
          </View>
        )}

        {activeTab === 'leadership' && (
          <View style={{ gap: spacing.md }}>
            {leaders.length > 0 ? (
              leaders.map((item) => (
                <LeaderCard
                  key={item.id}
                  name={item.name}
                  roleTitle={item.role_title}
                  biography={item.biography}
                  variant={item.is_founder ? 'founder' : 'standard'}
                  dark={isDark}
                />
              ))
            ) : (
              <EmptyState title="No Leaders Listed" message="Pastoral leaders will appear here." icon="👥" dark={isDark} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '800',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100,
  },
  bannerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  expressionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  expressionSub: {
    fontSize: 12,
    fontWeight: '700',
  },
  followPill: {
    backgroundColor: palette.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  followingPill: {
    backgroundColor: 'rgba(255, 253, 249, 0.2)',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  followText: {
    color: '#140C07',
    fontSize: 11,
    fontWeight: '900',
  },
  followingText: {
    color: palette.gold,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
});
