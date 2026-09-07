import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import {
  BottomSheet,
  Button,
  Icon,
  InputField,
  LeadershipModuleCard,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

export default function CreatorStudioScreen({ forcedScope }: { forcedScope?: 'general' } = {}) {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability, hasOrganizationCapability, hasPublicCapability } = useSession();
  const generalWorkspace = forcedScope === 'general';
  const expression = generalWorkspace ? undefined : context?.expression;
  const canPublishPosts = generalWorkspace
    ? hasOrganizationCapability('posts.create') || hasOrganizationCapability('posts.publish')
    : hasCapability('posts.create') || hasCapability('posts.publish');
  const canPublishPublicReels =
    hasOrganizationCapability('media.upload') &&
    hasOrganizationCapability('reels.publish');
  const canPublishExpressionReels =
    Boolean(expression?.id) &&
    hasCapability('media.upload') &&
    hasCapability('reels.publish');
  const canPublishPublicVideos =
    hasOrganizationCapability('media.upload') &&
    hasOrganizationCapability('videos.publish');
  const canPublishExpressionVideos =
    Boolean(expression?.id) &&
    hasCapability('media.upload') &&
    hasCapability('videos.publish');
  const expressionCreatorOrganizationId = context?.organization?.id ?? context?.creatorOrganizations?.[0]?.id ?? '';
  const canCreateExpression = Boolean(
    expressionCreatorOrganizationId &&
    context?.creatorOrganizations?.some((item) => item.id === expressionCreatorOrganizationId),
  );
  const canModerateGeneralPrayer =
    hasOrganizationCapability('prayer.moderate') &&
    (hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive'));
  const canModerateExpressionPrayer =
    Boolean(expression?.id) &&
    hasCapability('prayer.moderate') &&
    (hasCapability('prayer.pastoral.receive') || hasCapability('prayer.team.receive'));
  const canAccessPastoral =
    canModerateGeneralPrayer ||
    canModerateExpressionPrayer ||
    hasOrganizationCapability('pastoral.followups.receive') ||
    (Boolean(expression?.id) && hasCapability('pastoral.followups.receive'));
  const { colors } = useTheme();

  const [activeModal, setActiveModal] = useState<'post' | null>(null);
  const [postBody, setPostBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [publishNotice, setPublishNotice] = useState('');
  const [publishError, setPublishError] = useState('');

  if (!generalWorkspace && expression?.id) {
    return <Redirect href={`/expressions/${expression.id}/manage/studio` as any} />;
  }
  if (!generalWorkspace && !forcedScope) {
    return <Redirect href="/general/studio" />;
  }

  const handlePublishPost = async () => {
    if (!postBody.trim()) return;
    setSubmitting(true);
    setPublishError('');
    setPublishNotice('');
    try {
      await api.request('creator-studio', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish_post',
          expressionId: expression?.id ?? null,
          visibility: expression?.id ? 'branch' : 'public',
          body: postBody.trim(),
        }),
      });
      setPostBody('');
      setActiveModal(null);
      setPublishNotice(
        expression?.name
          ? `Your announcement is live inside ${expression.name}.`
          : 'Your announcement is live in the General Community.',
      );
    } catch (err: unknown) {
      setPublishError('We couldn’t publish this announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const routeFor = (generalRoute: string, legacyRoute: string) =>
    generalWorkspace ? generalRoute : legacyRoute;

  const leadershipModules = [
    {
      title: 'Create Reel',
      description: generalWorkspace ? 'Upload and publish a short vertical video to General COT.' : 'Upload and publish a short vertical video to public COT or the active Expression.',
      iconName: 'flash-outline',
      badge: 'REELS',
      route: routeFor('/general/studio/reel', '/studio/reel'),
      enabled: canPublishPublicReels || canPublishExpressionReels,
    },
    {
      title: 'Create Watch Video',
      description: 'Upload and publish long-form teachings, worship, testimonies and other video.',
      iconName: 'videocam-outline',
      badge: 'WATCH',
      route: routeFor('/general/studio/video', '/studio/video'),
      enabled: canPublishPublicVideos || canPublishExpressionVideos,
    },
    {
      title: 'Sermons',
      description: 'Create sermon drafts, manage teachings and publish when ready.',
      iconName: 'book-outline',
      badge: 'MEDIA',
      route: routeFor('/general/leadership/sermons-manage', '/leadership/sermons'),
      enabled: generalWorkspace ? (hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage')) : (hasCapability('sermons.create') || hasCapability('sermons.manage')),
    },
    {
      title: 'Events',
      description: 'Create and manage church gatherings and events.',
      iconName: 'calendar-outline',
      badge: 'EVENTS',
      route: routeFor('/general/leadership/events-manage', '/leadership/events'),
      enabled: generalWorkspace ? (hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update')) : (hasCapability('events.create') || hasCapability('events.update')),
    },
    {
      title: 'Live Media Studio',
      description: 'Create and manage live broadcasts available to you.',
      iconName: 'radio-outline',
      badge: 'BROADCAST',
      route: routeFor('/general/leadership/media-studio', '/leadership/media-studio'),
      enabled: hasPublicCapability('public.live_stream.create') || (Boolean(expression?.id) && hasCapability('streams.broadcast')),
    },
    {
      title: 'Pastoral Care',
      description: 'Review confidential prayer requests and care follow-ups.',
      iconName: 'heart-outline',
      badge: 'PASTORAL',
      route: routeFor('/general/leadership/pastoral-triage', '/leadership/pastoral-triage'),
      enabled: canAccessPastoral,
    },
    {
      title: 'Giving Setup',
      description: 'Manage giving destinations, purposes and transfer accounts.',
      iconName: 'gift-outline',
      badge: 'GIVING',
      route: routeFor('/general/leadership/giving-manage', '/(tabs)/profile/leadership/giving-manage'),
      enabled: generalWorkspace ? hasOrganizationCapability('giving.campaigns.manage') : hasCapability('giving.campaigns.manage'),
    },
    {
      title: 'Giving Reports',
      description: 'Review read-only giving totals and refunds by currency.',
      iconName: 'analytics-outline',
      badge: 'FINANCE',
      route: routeFor('/general/leadership/giving-finance', '/(tabs)/profile/leadership/giving-finance'),
      enabled: generalWorkspace ? hasOrganizationCapability('giving.finance.read') : hasCapability('giving.finance.read'),
    },
    {
      title: 'Expressions',
      description: 'Create and manage Expressions available to your account.',
      iconName: 'people-outline',
      badge: 'COMMUNITY',
      route: routeFor('/general/leadership/expressions-manage', '/leadership/expressions'),
      enabled: canCreateExpression,
    },
    {
      title: 'Church Leadership',
      description: 'Manage church-wide leaders and public leadership presentation.',
      iconName: 'business-outline',
      badge: 'CHURCH',
      route: routeFor('/general/leadership/church-leadership', '/(tabs)/profile/leadership/church-leadership'),
      enabled: hasOrganizationCapability('organization.leadership.manage'),
    },
    {
      title: 'Expression Leadership',
      description: 'Manage leaders and ministry teams in this Expression.',
      iconName: 'people-circle-outline',
      badge: 'DIRECTORY',
      route: '/leadership/directory',
      enabled: !generalWorkspace && Boolean(expression?.id) && hasCapability('expression.leadership.manage'),
    },
  ].filter((module) => module.enabled);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader
          title="Ministry Studio"
          kicker="LEADERSHIP"
          subtitle="Create, publish and manage your ministry content in one place."
          showBack
        />

        <View style={styles.body}>
          {publishNotice ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Icon name="checkmark-circle" size={17} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{publishNotice}</Text>
            </View>
          ) : null}
          {canPublishPosts ? (
          <View style={[styles.quickPostCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.quickPostHeader}>
              <Icon name="create-outline" size={20} color={colors.interactive} />
              <Text style={[styles.quickPostTitle, { color: colors.text }]}>Quick Community Announcement</Text>
            </View>
            <Text style={[styles.quickPostSub, { color: colors.textSecondary }]}>
              {expression?.name
                ? `Share an encouragement or update inside ${expression.name}.`
                : 'Share an encouragement or ministry update with the General Community.'}
            </Text>
            <Button
              label="Compose Announcement"
              onPress={() => setActiveModal('post')}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>
          ) : null}

          {/* Operational Leadership Modules Grid */}
          <View style={styles.modulesSection}>
            <SectionHeader title="Your tools" badge={leadershipModules.length} subtitle="Only the tools available to you are shown" />
            {leadershipModules.map((module, idx) => (
              <LeadershipModuleCard
                key={idx}
                title={module.title}
                description={module.description}
                iconName={module.iconName}
                badge={module.badge}
                onPress={() => router.push(module.route as any)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={activeModal === 'post'}
        onClose={() => {
          if (!submitting) {
            setActiveModal(null);
            setPublishError('');
          }
        }}
        title="Publish announcement"
        subtitle={expression?.name ? `Share inside ${expression.name}.` : 'Share with the General Community.'}
      >
        {publishError ? (
          <View style={[styles.banner, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}>
            <Icon name="alert-circle" size={17} color={colors.live} />
            <Text style={[styles.bannerText, { color: colors.live }]}>{publishError}</Text>
          </View>
        ) : null}
        <InputField
          label="Announcement"
          value={postBody}
          onChangeText={setPostBody}
          multiline
          numberOfLines={5}
          placeholder="Write your pastoral announcement or encouragement..."
        />
        <View style={styles.modalActions}>
          <Button label="Cancel" onPress={() => { setActiveModal(null); setPublishError(''); }} variant="outline" size="md" disabled={submitting} />
          <Button label="Publish" onPress={handlePublishPost} loading={submitting} variant="primary" size="md" />
        </View>
      </BottomSheet>
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
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  quickPostCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
  },
  quickPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickPostTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickPostSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  modulesSection: {
    gap: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
