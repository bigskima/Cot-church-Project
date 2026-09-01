import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Icon,
  LeaderCard,
  ReelCard,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  SermonCard,
  Skeleton,
  VideoCard,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Leader, Reel, Sermon, Video } from '@/types/content';

const organization = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function ExpressionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode } = useSession();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'overview' | 'sermons' | 'watch' | 'reels' | 'leadership'>('overview');
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch Expression Sermons
  const sermonsResource = useResource<Sermon[]>(`exp:sermons:${id}`, (signal) =>
    api.request<Sermon[]>(`public-content?type=sermons&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal }).catch(() => [])
  );

  // Fetch Expression Videos
  const videosResource = useResource<Video[]>(`exp:videos:${id}`, (signal) =>
    api.request<Video[]>(`public-content?type=videos&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal }).catch(() => [])
  );

  // Fetch Expression Reels
  const reelsResource = useResource<Reel[]>(`exp:reels:${id}`, (signal) =>
    api.request<Reel[]>(`public-content?type=reels&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal }).catch(() => [])
  );

  // Fetch Expression Leaders
  const leadersResource = useResource<Leader[]>(`exp:leaders:${id}`, (signal) =>
    api.request<Leader[]>(`public-content?type=leaders&expressionId=${id}${organization ? `&organizationId=${organization}` : ''}`, { signal }).catch(() => [])
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
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 60 },
        ]}
      >
        <ScreenHeader
          title="Campus Expression"
          subtitle="Teachings, video broadcasts, short clips, and leadership team."
          showBack
        />

        {/* Navigation Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <Chip
            label="Overview"
            selected={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
          />
          <Chip
            label="Sermons"
            selected={activeTab === 'sermons'}
            onPress={() => setActiveTab('sermons')}
            count={sermons.length}
          />
          <Chip
            label="Watch"
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
            label="Leaders"
            selected={activeTab === 'leadership'}
            onPress={() => setActiveTab('leadership')}
            count={leaders.length}
          />
        </ScrollView>

        <View style={styles.body}>
          {activeTab === 'overview' && (
            <View style={styles.sectionWrap}>
              {sermons.length > 0 && (
                <View>
                  <SectionHeader title="Latest Sermons" />
                  {sermons.slice(0, 2).map((s) => (
                    <SermonCard
                      key={s.id}
                      sermon={s}
                      onPress={() => router.push(`/(tabs)/discover/sermon/${s.id}`)}
                    />
                  ))}
                </View>
              )}

              {videos.length > 0 && (
                <View>
                  <SectionHeader title="Campus Videos" />
                  {videos.slice(0, 2).map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      onPress={() => router.push(`/watch/${v.id}`)}
                    />
                  ))}
                </View>
              )}

              {leaders.length > 0 && (
                <View>
                  <SectionHeader title="Pastoral Team" />
                  {leaders.map((l) => (
                    <LeaderCard
                      key={l.id}
                      leader={l}
                      variant="standard"
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'sermons' && (
            <View style={styles.sectionWrap}>
              {sermons.length > 0 ? (
                sermons.map((s) => (
                  <SermonCard
                    key={s.id}
                    sermon={s}
                    onPress={() => router.push(`/(tabs)/discover/sermon/${s.id}`)}
                  />
                ))
              ) : (
                <EmptyState
                  title="No Sermons for this Campus"
                  message="Teachings published by this expression will appear here."
                  iconName="book-outline"
                />
              )}
            </View>
          )}

          {activeTab === 'watch' && (
            <View style={styles.sectionWrap}>
              {videos.length > 0 ? (
                videos.map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    onPress={() => router.push(`/watch/${v.id}`)}
                  />
                ))
              ) : (
                <EmptyState
                  title="No Videos for this Campus"
                  message="Video broadcasts published by this expression will appear here."
                  iconName="videocam-outline"
                />
              )}
            </View>
          )}

          {activeTab === 'reels' && (
            <View style={styles.reelsGrid}>
              {reels.length > 0 ? (
                reels.map((r) => (
                  <ReelCard
                    key={r.id}
                    reel={r}
                    onPress={() => router.push('/(tabs)/reels')}
                    width={150}
                  />
                ))
              ) : (
                <EmptyState
                  title="No Reels for this Campus"
                  message="Short-form clips will appear here."
                  iconName="film-outline"
                />
              )}
            </View>
          )}

          {activeTab === 'leadership' && (
            <View style={styles.sectionWrap}>
              {leaders.length > 0 ? (
                leaders.map((l) => (
                  <LeaderCard
                    key={l.id}
                    leader={l}
                    variant="standard"
                  />
                ))
              ) : (
                <EmptyState
                  title="No Campus Leaders Listed"
                  message="Pastoral leaders will appear here once assigned."
                  iconName="people-outline"
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  tabsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  sectionWrap: {
    gap: spacing.md,
  },
  reelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
});
