import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Chip,
  EmptyState,
  LeaderCard,
  ResourceError,
  ScreenHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { ChurchStory, LeadershipProfile } from '@church/types';

interface StoryResponse {
  story: ChurchStory | null;
  leadership: LeadershipProfile[];
}

export default function ChurchStoryScreen() {
  const insets = useSafeAreaInsets();
  const { api, context } = useSession();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'story' | 'leadership'>('story');

  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const orgParam = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

  const resource = useResource<StoryResponse>(`church:story:public:${organizationId || 'auto'}`, (signal) =>
    api.request(`church-story${orgParam}`, { signal })
  );

  const story = resource.data?.story;
  const leaders = resource.data?.leadership ?? [];

  const hasStoryContent =
    story && (story.mission || story.vision || story.founding_story || story.values?.length || story.history_milestones?.length);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <ScreenHeader
            title={story?.title ?? 'Our Story'}
            kicker="COT"
            subtitle={story?.subtitle ?? 'Mission, vision, heritage and pastoral leadership.'}
            showBack
          />
        </View>

        {/* Tab Toggle */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Chip
            label="History & Vision"
            selected={activeTab === 'story'}
            onPress={() => setActiveTab('story')}
          />
          <Chip
            label="Our Leaders"
            selected={activeTab === 'leadership'}
            onPress={() => setActiveTab('leadership')}
            count={leaders.length}
          />
        </View>

        <View style={styles.body}>
          {resource.loading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={120} borderRadius={radius.lg} />
              <Skeleton height={160} borderRadius={radius.lg} />
            </View>
          ) : resource.error && !resource.data ? (
            <ResourceError message={resource.error} retry={resource.refresh} />
          ) : activeTab === 'story' ? (
            hasStoryContent ? (
              <View style={styles.storySection}>
                {story.mission ? (
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                    <Text style={[styles.cardKicker, { color: colors.interactive }]}>OUR MISSION</Text>
                    <Text style={[styles.cardBody, { color: colors.text }]}>{story.mission}</Text>
                  </View>
                ) : null}

                {story.vision ? (
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                    <Text style={[styles.cardKicker, { color: colors.interactive }]}>OUR VISION</Text>
                    <Text style={[styles.cardBody, { color: colors.text }]}>{story.vision}</Text>
                  </View>
                ) : null}

                {story.founding_story ? (
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                    <Text style={[styles.cardKicker, { color: colors.interactive }]}>FOUNDING HERITAGE {story.founding_year ? `(${story.founding_year})` : ''}</Text>
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{story.founding_story}</Text>
                  </View>
                ) : null}

                {story.values && story.values.length > 0 ? (
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
                    <Text style={[styles.cardKicker, { color: colors.interactive }]}>CORE VALUES</Text>
                    <View style={styles.valuesList}>
                      {story.values.map((val, idx) => (
                        <View key={idx} style={[styles.valueBlock, { backgroundColor: colors.bgSecondary }]}>
                          <Text style={[styles.valueTitle, { color: colors.text }]}>{val.title}</Text>
                          {val.description ? (
                            <Text style={[styles.valueDesc, { color: colors.textSecondary }]}>{val.description}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <EmptyState
                title="Story Not Published Yet"
                message="The church leadership has not published mission, vision, or heritage information yet."
                iconName="library-outline"
              />
            )
          ) : (
            /* Leadership Tab */
            leaders.length > 0 ? (
              <View style={styles.leadersList}>
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
                message="Leadership profiles will appear here once configured by pastoral administration."
                iconName="people-outline"
              />
            )
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
  headerCard: { marginHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: 5,
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.xl,
    alignSelf: 'flex-start',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  storySection: {
    gap: spacing.md,
  },
  sectionCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: 6,
  },
  cardKicker: {
    ...typography.kicker,
  },
  cardBody: {
    ...typography.body,
    lineHeight: 22,
  },
  valuesList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  valueBlock: {
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: 2,
  },
  valueTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  valueDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  leadersList: {
    gap: spacing.xs,
  },
});
