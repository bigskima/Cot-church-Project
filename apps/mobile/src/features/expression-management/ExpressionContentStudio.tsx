import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, Icon, LeadershipModuleCard, SectionHeader } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useExpressionManagementAccess } from './useExpressionManagementAccess';

export function ExpressionContentStudio() {
  const { context } = useSession();
  const { colors } = useTheme();
  const access = useExpressionManagementAccess();
  const expression = context?.expression;
  const base = `/expressions/${access.expressionId}/manage`;

  const tools = [
    {
      key: 'post',
      title: 'Community Post',
      description: 'Write a post directly into this Expression feed.',
      iconName: 'create-outline',
      badge: 'POST',
      route: `/expressions/${access.expressionId}/feed`,
      enabled: access.canPublishExpressionPosts,
    },
    {
      key: 'reel',
      title: 'Create Reel',
      description: 'Upload a short vertical video that stays inside this Expression.',
      iconName: 'flash-outline',
      badge: 'REEL',
      route: `${base}/reel`,
      enabled: access.canPublishExpressionReels,
    },
    {
      key: 'video',
      title: 'Create Watch Video',
      description: 'Publish a long-form video into this Expression media library.',
      iconName: 'videocam-outline',
      badge: 'VIDEO',
      route: `${base}/video`,
      enabled: access.canPublishExpressionVideos,
    },
    {
      key: 'sermons',
      title: 'Sermon Studio',
      description: 'Create sermon drafts, attach media and publish teachings.',
      iconName: 'book-outline',
      badge: 'SERMON',
      route: `${base}/sermons`,
      enabled: access.canManageSermons,
    },
  ].filter((tool) => tool.enabled);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon name="color-wand-outline" size={23} color={colors.interactive} />
        </View>
        <View style={styles.copyWrap}>
          <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION STUDIO</Text>
          <Text style={[styles.title, { color: colors.text }]}>Content Studio</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>
            Create only for {expression?.name ?? 'this Expression'}. Public COT publishing is intentionally outside this workspace.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Create & publish" badge={access.ready ? tools.length : undefined} subtitle="Tools shown from your Expression role" />
        {access.ready && tools.length ? (
          tools.map((tool) => (
            <LeadershipModuleCard
              key={tool.key}
              title={tool.title}
              description={tool.description}
              iconName={tool.iconName}
              badge={tool.badge}
              onPress={() => router.push(tool.route as any)}
            />
          ))
        ) : access.ready ? (
          <EmptyState
            title="No publishing tools assigned"
            message="Your current Expression role does not include publishing authority."
            iconName="lock-closed-outline"
          />
        ) : null}
      </View>

      <View style={[styles.note, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
        <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>
          Expression Studio never upgrades an Expression permission into a church-wide or public publishing permission.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: spacing.md, paddingBottom: 90, gap: spacing.lg },
  hero: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 46, height: 46, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  copyWrap: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800', marginTop: 2 },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: { gap: spacing.sm },
  note: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
