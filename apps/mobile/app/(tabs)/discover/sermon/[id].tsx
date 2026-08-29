import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSession } from '@/state/session';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, ResourceError, Skeleton } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

export default function SermonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const [activeTab, setActiveTab] = useState<'study' | 'summary' | 'scriptures'>('study');

  const sermonResource = useResource<Sermon>(`sermon:${id}`, (signal) =>
    api.request<Sermon>(`sermons?id=${id}`, { signal })
  );

  const sermon = sermonResource.data;
  const playbackUrl = sermon?.video_url ? `https://stream.mux.com/${sermon.video_url}.m3u8` : null;

  const player = useVideoPlayer(playbackUrl, (p: any) => {
    p.loop = false;
  });

  if (sermonResource.loading) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton height={260} dark />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={24} width="50%" dark />
          <Skeleton height={32} width="80%" dark />
          <Skeleton height={100} dark />
        </View>
      </View>
    );
  }

  if (sermonResource.error && !sermon) {
    return (
      <View style={styles.errorScreen}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back to Sermons</Text>
        </Pressable>
        <View style={styles.errorWrapper}>
          <ResourceError
            offline={sermonResource.offline}
            message={sermonResource.error}
            retry={sermonResource.refresh}
            dark
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video / Audio Player Stage */}
      <View style={styles.mediaStage}>
        {playbackUrl ? (
          <VideoView player={player} style={styles.videoView} nativeControls />
        ) : (
          <View style={styles.audioPlaceholder}>
            <Text style={styles.audioIcon}>🎙️</Text>
            <Text style={styles.audioTitle}>Audio Recording Available</Text>
            <Text style={styles.audioSubtitle}>Video stream was not attached for this service.</Text>
          </View>
        )}

        <Pressable onPress={() => router.back()} style={styles.floatingBackButton}>
          <Text style={styles.floatingBackText}>‹</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sermon Title & Metadata */}
        <View style={styles.metaBox}>
          {sermon?.series?.title && (
            <Text style={styles.seriesKicker}>{sermon.series.title.toUpperCase()}</Text>
          )}
          <Text style={styles.sermonTitle}>{sermon?.title}</Text>
          <Text style={styles.preacherMeta}>
            Preached by <Text style={{ color: palette.white, fontWeight: '800' }}>{sermon?.preacher ?? 'Church Minister'}</Text> ·{' '}
            {sermon?.recorded_at ? new Date(sermon.recorded_at).toLocaleDateString() : ''}
          </Text>

          {/* Scripture Badges */}
          {sermon?.scripture_references && sermon.scripture_references.length > 0 && (
            <View style={styles.scriptureRow}>
              {sermon.scripture_references.map((ref, idx) => (
                <Badge key={idx} label={`📖 ${ref}`} variant="gold" />
              ))}
            </View>
          )}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          {[
            ['study', 'Notes & Overview'],
            ['summary', 'AI Takeaways'],
            ['scriptures', 'Scripture Study'],
          ].map(([key, label]) => {
            const isSelected = activeTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveTab(key as any)}
                style={({ pressed }) => [
                  styles.tabItem,
                  isSelected && styles.tabItemActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tab Content */}
        {activeTab === 'study' && (
          <View style={styles.tabContentBox}>
            <Text style={styles.sectionHeading}>Message Summary</Text>
            <Text style={styles.bodyText}>
              {sermon?.description ||
                'This message explores deep biblical truth and practical spiritual alignment for your walk with God.'}
            </Text>

            {sermon?.transcript && (
              <View style={styles.transcriptBox}>
                <Text style={styles.sectionHeading}>Transcript Excerpt</Text>
                <Text style={styles.transcriptText}>{sermon.transcript}</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'summary' && (
          <View style={styles.tabContentBox}>
            <View style={styles.aiHeaderRow}>
              <Text style={styles.aiSparkle}>✦</Text>
              <Text style={styles.sectionHeading}>Spiritual Key Takeaways</Text>
            </View>
            <View style={styles.takeawayList}>
              {[
                'Faith requires intentional alignment and active obedience to God’s Word.',
                'The Holy Spirit empowers believers to overcome secular pressure with grace.',
                'Prayer is our primary spiritual warfare instrument and communion pathway.',
              ].map((point, index) => (
                <View key={index} style={styles.takeawayItem}>
                  <Text style={styles.takeawayBullet}>0{index + 1}</Text>
                  <Text style={styles.takeawayText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'scriptures' && (
          <View style={styles.tabContentBox}>
            <Text style={styles.sectionHeading}>Referenced Passages</Text>
            {sermon?.scripture_references && sermon.scripture_references.length > 0 ? (
              sermon.scripture_references.map((passage, idx) => (
                <View key={idx} style={styles.passageCard}>
                  <Text style={styles.passageTitle}>{passage}</Text>
                  <Text style={styles.passageText}>
                    "Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths."
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyText}>No specific scriptures attached to this record.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.midnight,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: palette.midnight,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: palette.midnight,
    padding: spacing.lg,
    paddingTop: 60,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF1A',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: palette.white,
    fontWeight: '800',
  },
  errorWrapper: {
    marginTop: 40,
  },
  mediaStage: {
    height: 270,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoView: {
    flex: 1,
  },
  audioPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  audioIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  audioTitle: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  audioSubtitle: {
    color: '#8E9EB5',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 48,
    left: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBackText: {
    color: palette.white,
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  metaBox: {
    marginBottom: spacing.lg,
  },
  seriesKicker: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sermonTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.white,
    letterSpacing: -0.4,
  },
  preacherMeta: {
    color: '#8E9EB5',
    fontSize: 13,
    marginTop: 6,
  },
  scriptureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceDarkElevated,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: palette.gold,
  },
  tabLabel: {
    color: '#8E9EB5',
    fontSize: 12,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: palette.midnight,
    fontWeight: '900',
  },
  tabContentBox: {
    backgroundColor: palette.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.white,
    marginBottom: spacing.sm,
  },
  bodyText: {
    color: '#B6C2D4',
    fontSize: 14,
    lineHeight: 22,
  },
  transcriptBox: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.lineDark,
  },
  transcriptText: {
    color: '#8E9EB5',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  aiSparkle: {
    color: palette.gold,
    fontSize: 18,
    marginRight: 6,
  },
  takeawayList: {
    gap: spacing.md,
  },
  takeawayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceDarkElevated,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  takeawayBullet: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: '900',
    marginRight: spacing.md,
    marginTop: 2,
  },
  takeawayText: {
    flex: 1,
    color: palette.white,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  passageCard: {
    backgroundColor: palette.surfaceDarkElevated,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  passageTitle: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  passageText: {
    color: '#B6C2D4',
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
