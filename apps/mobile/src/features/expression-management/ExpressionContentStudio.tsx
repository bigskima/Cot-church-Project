import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, Icon, SectionHeader } from '@/components';
import { ExpressionManagementHeader } from '@/components/expression/ExpressionManagementHeader';
import { radius, shadows, spacing } from '@/design-system/tokens';
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
      title: 'Community Post',
      description: 'Share text, photos or member updates in the Expression feed.',
      iconName: 'create-outline',
      label: 'SOCIAL',
      route: `/expressions/${access.expressionId}/feed`,
      enabled: access.canPublishExpressionPosts,
    },
    {
      key: 'reel',
      title: 'Create Reel',
      description: 'Publish a short vertical video for members of this Expression.',
      iconName: 'flash-outline',
      label: 'SHORT VIDEO',
      route: `${base}/reel`,
      enabled: access.canPublishExpressionReels,
    },
    {
      key: 'video',
      title: 'Create Video',
      description: 'Add long-form Watch content to this Expression media library.',
      iconName: 'videocam-outline',
      label: 'LONG FORM',
      route: `${base}/video`,
      enabled: access.canPublishExpressionVideos,
    },
    {
      key: 'sermons',
      title: 'Sermon Studio',
      description: 'Create sermon drafts, attach media and publish teachings.',
      iconName: 'book-outline',
      label: 'TEACHING',
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
        title="Content Studio"
        subtitle="Choose the content format first, then work in a focused publishing flow."
        icon="color-wand-outline"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.scopeCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
          <View style={[styles.scopeIcon, { backgroundColor: colors.card }]}>
            <Icon name="lock-closed-outline" size={17} color={colors.interactive} />
          </View>
          <View style={styles.scopeCopy}>
            <Text style={[styles.scopeTitle, { color: colors.text }]}>Publishing to {expressionName}</Text>
            <Text style={[styles.scopeText, { color: colors.textSecondary }]}>
              Everything started here targets this private Expression rather than the General COT feed.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Choose a format"
            badge={access.ready ? tools.length : undefined}
            subtitle="Each format opens its own focused creation flow."
          />

          {access.ready && tools.length ? (
            <View style={styles.toolGrid}>
              {tools.map((tool) => (
                <Pressable
                  key={tool.key}
                  onPress={() => router.push(tool.route as any)}
                  accessibilityRole="button"
                  accessibilityLabel={tool.title}
                  style={({ pressed }) => [
                    styles.toolCard,
                    { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                    shadows.sm,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.toolTop}>
                    <View style={[styles.toolIcon, { backgroundColor: colors.primarySoft }]}>
                      <Icon name={tool.iconName as any} size={22} color={colors.interactive} />
                    </View>
                    <Text style={[styles.toolLabel, { color: colors.interactive }]}>{tool.label}</Text>
                  </View>
                  <Text style={[styles.toolTitle, { color: colors.text }]}>{tool.title}</Text>
                  <Text style={[styles.toolDescription, { color: colors.textSecondary }]} numberOfLines={3}>{tool.description}</Text>
                  <View style={styles.toolAction}>
                    <Text style={[styles.toolActionText, { color: colors.interactive }]}>Open</Text>
                    <Icon name="arrow-forward-outline" size={15} color={colors.interactive} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : access.ready ? (
            <EmptyState
              title="No publishing tools available"
              message="You can still participate in this Expression. Publishing tools will appear if you’re added to its content team."
              iconName="lock-closed-outline"
            />
          ) : null}
        </View>

        <View style={[styles.note, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            Content created here stays in this Expression. General COT publishing is handled separately.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 90, gap: spacing.lg },
  scopeCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scopeIcon: { width: 38, height: 38, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  scopeCopy: { flex: 1, minWidth: 0 },
  scopeTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  scopeText: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  section: { gap: spacing.sm },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolCard: {
    width: '48.5%',
    minWidth: 260,
    flexGrow: 1,
    minHeight: 160,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  toolTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  toolIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.75 },
  toolTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', letterSpacing: -0.25, marginTop: spacing.md },
  toolDescription: { fontSize: 11, lineHeight: 16, marginTop: 3, minHeight: 34 },
  toolAction: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  toolActionText: { fontSize: 10, lineHeight: 14, fontWeight: '900' },
  note: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
