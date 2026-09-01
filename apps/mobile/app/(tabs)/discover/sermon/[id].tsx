import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  Chip,
  Icon,
  MediaPlayer,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Sermon } from '@/types/content';

export default function SermonDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'study' | 'summary' | 'scriptures'>('study');

  const sermonResource = useResource<Sermon>(`sermon:${id}`, async (signal) => {
    const res = await api.request<Sermon | { data: Sermon }>(`sermons?id=${id}`, { signal });
    if ('data' in (res as any)) return (res as any).data;
    return res as Sermon;
  });

  const sermon = sermonResource.data;

  const formattedDate = sermon?.sermon_date
    ? new Date(sermon.sermon_date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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
          title={sermon?.title ?? 'Sermon Teaching'}
          subtitle={sermon?.preacher ? `By ${sermon.preacher}` : undefined}
          showBack
        />

        {sermonResource.loading ? (
          <View style={styles.pad}>
            <Skeleton height={220} borderRadius={radius.lg} />
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Skeleton height={24} width="40%" />
              <Skeleton height={32} width="80%" />
              <Skeleton height={80} />
            </View>
          </View>
        ) : sermonResource.error && !sermon ? (
          <View style={styles.pad}>
            <ResourceError message={sermonResource.error} retry={sermonResource.refresh} />
          </View>
        ) : sermon ? (
          <View style={styles.pad}>
            {/* Media Player */}
            <MediaPlayer
              title={sermon.title}
              preacherOrArtist={sermon.preacher}
              posterUrl={sermon.thumbnail_url}
              hasAudio={!!sermon.audio_url || !!sermon.audio_asset_id}
              hasVideo={!!sermon.video_url || !!sermon.video_asset_id}
              scriptureReferences={sermon.scripture_references}
            />

            {/* Sermon Metadata Header */}
            <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
              {sermon.series?.title ? (
                <Text style={[styles.seriesTag, { color: colors.interactive }]}>
                  SERIES: {sermon.series.title.toUpperCase()}
                </Text>
              ) : null}
              <Text style={[styles.title, { color: colors.text }]}>{sermon.title}</Text>

              <View style={styles.metaRow}>
                {sermon.preacher ? (
                  <View style={styles.metaItem}>
                    <Icon name="person-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {sermon.preacher}
                    </Text>
                  </View>
                ) : null}
                {formattedDate ? (
                  <View style={styles.metaItem}>
                    <Icon name="calendar-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {formattedDate}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Study Navigation Tabs */}
            <View style={styles.tabRow}>
              <Chip
                label="Message Overview"
                selected={activeTab === 'study'}
                onPress={() => setActiveTab('study')}
              />
              {sermon.ai_summary ? (
                <Chip
                  label="Study Summary"
                  selected={activeTab === 'summary'}
                  onPress={() => setActiveTab('summary')}
                  icon={<Icon name="sparkles" size={12} color={colors.interactive} />}
                />
              ) : null}
              {sermon.scripture_references && sermon.scripture_references.length > 0 ? (
                <Chip
                  label="Scriptures"
                  selected={activeTab === 'scriptures'}
                  onPress={() => setActiveTab('scriptures')}
                  count={sermon.scripture_references.length}
                />
              ) : null}
            </View>

            {/* Tab Body */}
            {activeTab === 'study' ? (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  {sermon.description || 'No extended description available for this teaching.'}
                </Text>
              </View>
            ) : activeTab === 'summary' && sermon.ai_summary ? (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.aiHeader}>
                  <Icon name="sparkles" size={16} color={colors.interactive} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Teaching Synthesis</Text>
                </View>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  {sermon.ai_summary}
                </Text>
              </View>
            ) : (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Scripture Passages</Text>
                <View style={styles.scripturesWrap}>
                  {sermon.scripture_references?.map((ref, idx) => (
                    <View key={idx} style={[styles.scriptureBlock, { backgroundColor: colors.bgSecondary }]}>
                      <Icon name="book-outline" size={16} color={colors.interactive} />
                      <Text style={[styles.scriptureRefText, { color: colors.text }]}>{ref}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : null}
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
  pad: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  metaCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  seriesTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.h2,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    ...typography.h3,
  },
  bodyText: {
    ...typography.body,
    lineHeight: 22,
  },
  scripturesWrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  scriptureBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  scriptureRefText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
