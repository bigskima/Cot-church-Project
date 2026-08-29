import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { EmptyState, LeaderCard, ResourceError, Skeleton, ScreenHeader } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { ChurchStory, LeadershipProfile } from '@church/types';

interface StoryResponse {
  story: ChurchStory;
  leadership: LeadershipProfile[];
}

const publicOrg = process.env.EXPO_PUBLIC_ORGANIZATION_ID;

export default function ChurchStoryScreen() {
  const { api, mode } = useSession();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'story' | 'leadership'>('story');

  const orgParam = mode === 'visitor' ? `?organizationId=${publicOrg}` : '';

  const resource = useResource<StoryResponse>('church:story:public', (signal) =>
    api.request(`church-story${orgParam}`, { signal })
  );

  const story = resource.data?.story;
  const leaders = resource.data?.leadership ?? [];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title={story?.title ?? 'Our Story & Heritage'}
        subtitle={story?.subtitle ?? 'A global sanctuary family devoted to Christ, community, and service.'}
        showBack
        dark={isDark}
      />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <View
          style={[
            styles.tabPillContainer,
            { backgroundColor: isDark ? '#22140C' : '#E8D5C4' },
          ]}
        >
          {(['story', 'leadership'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabPill,
                  isSelected && {
                    backgroundColor: isDark ? '#2E1C11' : '#FFFDF9',
                    ...shadows.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    { color: isSelected ? colors.text : colors.textMuted },
                    isSelected && styles.tabPillTextActive,
                  ]}
                >
                  {tab === 'story' ? 'History & Vision' : 'Our Leaders'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.body}>
        {resource.loading ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={140} dark={isDark} />
            <Skeleton height={100} dark={isDark} />
          </View>
        ) : resource.error && !resource.data ? (
          <ResourceError
            offline={resource.offline}
            message={resource.error}
            retry={resource.refresh}
            dark={isDark}
          />
        ) : activeTab === 'story' ? (
          <View style={{ gap: spacing.md }}>
            {/* Mission & Vision Card */}
            <View style={[styles.missionCard, shadows.md] as any}>
              <Text style={styles.cardKicker as any}>OUR MISSION</Text>
              <Text style={styles.missionText as any}>
                {story?.mission || 'To proclaim the Gospel of Jesus Christ and build authentic disciples worldwide.'}
              </Text>

              <View style={styles.cardDivider as any} />

              <Text style={styles.cardKicker as any}>OUR VISION</Text>
              <Text style={styles.visionText as any}>
                {story?.vision || 'A multi-generational, spirit-filled movement transforming cities through love and truth.'}
              </Text>
            </View>

            {/* Founding Heritage */}
            <View
              style={[
                styles.storyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
              ] as any}
            >
              <Text style={[styles.cardTitle, { color: colors.text }] as any}>Founding & Heritage</Text>
              <Text style={styles.foundingYearText as any}>
                ESTABLISHED {story?.founding_year ?? 2010}
              </Text>
              <Text style={[styles.storyBodyText, { color: colors.textSecondary }] as any}>
                {story?.founding_story ||
                  'Founded with a passion for biblical orthodoxy, passionate worship, and caring fellowship. Over the years, God has expanded this work across multiple expressions while maintaining our core family heartbeat.'}
              </Text>
            </View>

            {/* Historical Milestones */}
            {story?.history_milestones && story.history_milestones.length > 0 && (
              <View
                style={[
                  styles.storyCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ] as any}
              >
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 14 }] as any}>
                  Key Milestones
                </Text>
                {story.history_milestones.map((m, idx) => (
                  <View key={idx} style={styles.milestoneRow as any}>
                    <View
                      style={[
                        styles.milestoneYearBox,
                        { backgroundColor: isDark ? '#2E1C11' : '#F1E3D3' },
                      ] as any}
                    >
                      <Text style={styles.milestoneYearText as any}>{m.year}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.milestoneTitle, { color: colors.text }] as any}>{m.title}</Text>
                      <Text style={[styles.milestoneDesc, { color: colors.textMuted }] as any}>
                        {m.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Core Values */}
            {story?.values && story.values.length > 0 && (
              <View
                style={[
                  styles.storyCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  shadows.sm,
                ] as any}
              >
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }] as any}>
                  Our Core Values
                </Text>
                {story.values.map((v, idx) => (
                  <View key={idx} style={{ marginBottom: 12 }}>
                    <Text style={styles.valueTitle as any}>✦ {v.title}</Text>
                    <Text style={[styles.valueDesc, { color: colors.textMuted }] as any}>
                      {v.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Leadership Directory */
          <View>
            <Text style={[styles.sectionHeading, { color: colors.text }] as any}>
              Church Leadership
            </Text>
            <Text style={[styles.sectionSubheading, { color: colors.textMuted }] as any}>
              Founding ministers, lead pastors, and expression leaders serving our global sanctuary.
            </Text>

            {leaders.length > 0 ? (
              leaders.map((leader) => (
                <LeaderCard
                  key={leader.id}
                  leader={leader}
                  variant={leader.is_founder ? 'featured' : 'standard'}
                  dark={isDark}
                />
              ))
            ) : (
              <EmptyState
                title="Leadership Directory"
                message="Public leadership profiles will appear here once curated."
                icon="👥"
                dark={isDark}
              />
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabPillContainer: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tabPillTextActive: {
    fontWeight: '900',
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  missionCard: {
    backgroundColor: '#140C07',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#452A1A',
  },
  cardKicker: {
    color: palette.yellow,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  missionText: {
    color: '#FFFDF9',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
    lineHeight: 24,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#2E1C11',
    marginVertical: 16,
  },
  visionText: {
    color: '#E6CCB2',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  storyCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  foundingYearText: {
    color: palette.yellowDark,
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  storyBodyText: {
    marginTop: 10,
    lineHeight: 24,
    fontSize: 15,
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  milestoneYearBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneYearText: {
    fontWeight: '900',
    color: palette.yellowDark,
    fontSize: 12,
  },
  milestoneTitle: {
    fontWeight: '800',
    fontSize: 15,
  },
  milestoneDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  valueTitle: {
    fontWeight: '800',
    color: palette.yellowDark,
    fontSize: 15,
  },
  valueDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionSubheading: {
    fontSize: 13,
    marginBottom: 16,
  },
  leaderCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  leaderHeaderRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  leaderPortrait: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  leaderAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#140C07',
  },
  leaderName: {
    fontSize: 17,
    fontWeight: '900',
  },
  founderTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  founderTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#92400E',
  },
  leaderRoleText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.yellowDark,
    marginTop: 2,
  },
  leaderMinistryText: {
    fontSize: 11,
    marginTop: 2,
  },
  leaderBioText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});
