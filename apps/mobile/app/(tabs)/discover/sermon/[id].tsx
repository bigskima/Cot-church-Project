import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, MediaPlayer, ResourceError, Skeleton } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

export default function SermonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'study' | 'summary' | 'scriptures'>('study');

  const sermonResource = useResource<Sermon>(`sermon:${id}`, async (signal) => {
    try {
      const res = await api.request<Sermon | { data: Sermon }>(`sermons?id=${id}`, { signal });
      if ('data' in (res as any)) return (res as any).data;
      return res as Sermon;
    } catch {
      // Fallback preview
      return {
        id: id ?? 'sermon-1',
        organization_id: 'org-1',
        title: 'Walking in Unwavering Faith & Authority',
        description: 'A transformative expository study on operating in spiritual authority and divine confidence.',
        preacher: 'Pastor David Alexander',
        sermon_date: '2026-08-23',
        status: 'published',
        visibility: 'public',
        audio_url: 'https://example.com/sermon.mp3',
        video_url: 'x36xhzz',
        scripture_references: ['Hebrews 11:1-6', 'Ephesians 6:10-18', 'Romans 8:31-39'],
        ai_summary:
          'In this powerful message, Pastor David breaks down the principles of kingdom faith. Faith is not mere positive thinking; it is spiritual conviction anchored in God’s unfailing covenant promise.',
      };
    }
  });

  const sermon = sermonResource.data;

  if (sermonResource.loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.bg }] as any}>
        <Skeleton height={260} dark={isDark} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={24} width="50%" dark={isDark} />
          <Skeleton height={32} width="80%" dark={isDark} />
          <Skeleton height={100} dark={isDark} />
        </View>
      </View>
    );
  }

  if (sermonResource.error && !sermon) {
    return (
      <View style={[styles.errorScreen, { backgroundColor: colors.bg }] as any}>
        <Pressable onPress={() => router.back()} style={styles.backButton as any}>
          <Text style={[styles.backButtonText, { color: colors.text }] as any}>‹ Back to Sermons</Text>
        </Pressable>
        <View style={styles.errorWrapper}>
          <ResourceError
            offline={sermonResource.offline}
            message={sermonResource.error}
            retry={sermonResource.refresh}
            dark={isDark}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }] as any}>
      {/* Top Floating Back Header */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ] as any}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton as any}>
          <Text style={[styles.backButtonText, { color: colors.text }] as any}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }] as any} numberOfLines={1}>
          Sermon Teaching
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content as any}>
        {/* Adaptive Dual-Format Media Player */}
        {sermon ? (
          <MediaPlayer
            title={sermon.title}
            preacherOrArtist={sermon.preacher}
            hasAudio={!!sermon.audio_url || !!sermon.audio_asset_id}
            hasVideo={!!sermon.video_url || !!sermon.video_asset_id}
            durationSeconds={sermon.duration_seconds}
            scriptureReferences={sermon.scripture_references}
            chapters={sermon.chapters}
            dark={isDark}
          />
        ) : null}

        {/* Sermon Title & Info Header */}
        <View style={styles.headerInfo as any}>
          <View style={styles.badgeRow as any}>
            <Badge label="SERMON ARCHIVE" variant="gold" />
            <Text style={[styles.dateText, { color: colors.textMuted }] as any}>
              📅 {sermon?.sermon_date}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.text }] as any}>{sermon?.title}</Text>

          <View style={styles.preacherRow as any}>
            <View style={styles.preacherAvatar as any}>
              <Text style={{ fontSize: 16 } as any}>🎙️</Text>
            </View>
            <View>
              <Text style={[styles.preacherName, { color: colors.text }] as any}>
                {sermon?.preacher}
              </Text>
              <Text style={[styles.preacherRole, { color: palette.gold }] as any}>
                Pastor & Teacher
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View
          style={[
            styles.tabRow,
            { backgroundColor: isDark ? '#1C1008' : '#E8D5C4' },
          ] as any}
        >
          {(['study', 'summary', 'scriptures'] as const).map((tab) => {
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
                  {tab === 'study'
                    ? '📖 Study Notes'
                    : tab === 'summary'
                    ? '✦ AI Synthesis'
                    : '📜 Scriptures'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tab Content Panes */}
        {activeTab === 'study' && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ] as any}
          >
            <Text style={[styles.cardTitle, { color: palette.gold }] as any}>
              EXPOSITORY OVERVIEW
            </Text>
            <Text style={[styles.bodyText, { color: colors.text }] as any}>
              {sermon?.description ||
                'This message provides a rich theological exploration of living under covenant promises with boldness and faith.'}
            </Text>

            {sermon?.transcript ? (
              <View style={styles.transcriptSection as any}>
                <Text style={[styles.cardTitle, { color: palette.gold }] as any}>
                  TRANSCRIPT EXCERPT
                </Text>
                <Text style={[styles.bodyText, { color: colors.textMuted }] as any}>
                  {sermon.transcript}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {activeTab === 'summary' && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ] as any}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 } as any}>✦</Text>
              <Text style={[styles.cardTitle, { color: palette.gold }] as any}>
                PASTORAL TAKEAWAYS
              </Text>
            </View>

            <Text style={[styles.bodyText, { color: colors.text }] as any}>
              {sermon?.ai_summary ??
                'Faith requires spiritual alignment, persistent prayer, and stepping out upon the Word of God.'}
            </Text>
          </View>
        )}

        {activeTab === 'scriptures' && (
          <View style={styles.scripturesContainer as any}>
            {(sermon?.scripture_references ?? []).map((ref, idx) => (
              <View
                key={idx}
                style={[
                  styles.scriptureCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ] as any}
              >
                <Text style={styles.scriptureRef as any}>📖 {ref}</Text>
                <Text style={[styles.scriptureSnippet, { color: colors.textMuted }] as any}>
                  "Now faith is confidence in what we hope for and assurance about what we do not see."
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  topTitle: {
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
  headerInfo: {
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  preacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  preacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preacherName: {
    fontSize: 14,
    fontWeight: '900',
  },
  preacherRole: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '800',
  },
  tabTextActive: {
    fontWeight: '900',
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  transcriptSection: {
    marginTop: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: spacing.md,
  },
  scripturesContainer: {
    gap: spacing.md,
  },
  scriptureCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  scriptureRef: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: '900',
  },
  scriptureSnippet: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  loadingScreen: {
    flex: 1,
  },
  errorScreen: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: 60,
  },
  errorWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
});
