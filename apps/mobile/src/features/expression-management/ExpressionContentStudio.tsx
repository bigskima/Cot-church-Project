import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CompactRouteGrid, EmptyState, SectionHeader } from '@/components';
import { ExpressionManagementHeader } from '@/components/expression/ExpressionManagementHeader';
import { spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useExpressionManagementAccess } from './useExpressionManagementAccess';

export function ExpressionContentStudio() {
  const { context } = useSession();
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const expression = context?.expression;
  const expressionName = expression?.name ?? 'This Expression';
  const base = `/expressions/${access.expressionId}/manage`;

  const tools = [
    {
      key: 'post',
      title: 'Post',
      description: 'Share text, photos or member updates in the Expression feed.',
      iconName: 'create-outline',
      route: `/expressions/${access.expressionId}/feed`,
      enabled: access.canPublishExpressionPosts,
    },
    {
      key: 'reel',
      title: 'Reel',
      description: 'Publish a short video for members of this Expression.',
      iconName: 'flash-outline',
      route: `${base}/reel`,
      enabled: access.canPublishExpressionReels,
    },
    {
      key: 'video',
      title: 'Video',
      description: 'Add long-form media to this Expression.',
      iconName: 'videocam-outline',
      route: `${base}/video`,
      enabled: access.canPublishExpressionVideos,
    },
    {
      key: 'sermons',
      title: 'Sermon',
      description: 'Create, manage and publish Expression teaching.',
      iconName: 'book-outline',
      route: `${base}/sermons`,
      enabled: access.canManageSermons,
    },
  ].filter((tool) => tool.enabled);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ExpressionManagementHeader
        expressionId={access.expressionId}
        expressionName={expressionName}
        active="studio"
        title="Studio"
        subtitle="Expression publishing"
        icon="color-wand-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <SectionHeader title="Create" badge={access.ready ? tools.length : undefined} />

          {access.ready && tools.length ? (
            <CompactRouteGrid
              items={tools.map((tool) => ({
                key: tool.key,
                label: tool.title,
                icon: tool.iconName,
                accessibilityLabel: `${tool.title}. ${tool.description}`,
                onPress: () => router.push(tool.route as any),
              }))}
            />
          ) : access.ready ? (
            <EmptyState
              title="No publishing tools available"
              message="Publishing tools appear when your Expression role allows them."
              iconName="lock-closed-outline"
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 90,
  },
  section: { gap: spacing.sm },
});
