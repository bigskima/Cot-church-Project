import { useMemo } from 'react';
import { useSession } from '@/state/session';

export type GeneralMinistryArea = 'Create' | 'Content' | 'Care' | 'People' | 'Finance' | 'Media' | 'Settings';

export function useGeneralMinistryAccess() {
  const { mode, accessReady, context, hasOrganizationCapability, hasPublicCapability } = useSession();
  const authenticated = mode === 'authenticated';
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? context?.creatorOrganizations?.[0]?.id ?? '';
  const isAuthorizedExpressionCreator = Boolean(
    authenticated &&
    organizationId &&
    context?.creatorOrganizations?.some((item) => item.id === organizationId),
  );

  const access = useMemo(() => {
    const canCreatePosts = hasOrganizationCapability('posts.create') || hasOrganizationCapability('posts.publish');
    const canPublishMedia = hasOrganizationCapability('media.upload') && (
      hasOrganizationCapability('reels.publish') || hasOrganizationCapability('videos.publish')
    );
    const canManageSermons = hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage');
    const canManageEvents = hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update');
    const canManageAnnouncements = hasOrganizationCapability('announcements.manage');
    const canManagePolls = hasOrganizationCapability('polls.manage');
    const canManagePrayer = hasOrganizationCapability('prayer.moderate') && (
      hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive')
    );
    const canReceivePastoralFollowups = hasOrganizationCapability('pastoral.followups.receive');
    const canReviewTestimonies = hasOrganizationCapability('testimonies.review') || hasOrganizationCapability('testimonies.manage');
    const canManageGiving = hasOrganizationCapability('giving.campaigns.manage');
    const canReadGivingFinance = hasOrganizationCapability('giving.finance.read');
    const canManageLeadership = hasOrganizationCapability('organization.leadership.manage');
    const canBroadcastLive = hasPublicCapability('public.live_stream.create');
    const canManageExpressions = isAuthorizedExpressionCreator;
    const canManageCare = canManagePrayer || canReceivePastoralFollowups || canReviewTestimonies;
    const canCreateOfficialContent = canCreatePosts || canPublishMedia || canManageSermons || canManageEvents || canManageAnnouncements || canManagePolls;
    const canManageMedia = canBroadcastLive || canPublishMedia || canManageLeadership;
    const canManageSettings = canManageLeadership;

    const focusAreas: GeneralMinistryArea[] = [];
    if (canCreateOfficialContent) focusAreas.push('Create');
    if (canManageSermons || canManageEvents || canManageAnnouncements || canManagePolls) focusAreas.push('Content');
    if (canManageCare) focusAreas.push('Care');
    if (canManageLeadership || canManageExpressions) focusAreas.push('People');
    if (canManageGiving || canReadGivingFinance) focusAreas.push('Finance');
    if (canManageMedia) focusAreas.push('Media');
    if (canManageSettings) focusAreas.push('Settings');

    return {
      canCreatePosts,
      canPublishMedia,
      canManageSermons,
      canManageEvents,
      canManageAnnouncements,
      canManagePolls,
      canManageCare,
      canManagePrayer,
      canReceivePastoralFollowups,
      canReviewTestimonies,
      canManageGiving,
      canReadGivingFinance,
      canManageLeadership,
      canBroadcastLive,
      canManageExpressions,
      canManageMedia,
      canManageSettings,
      canCreateOfficialContent,
      focusAreas,
    };
  }, [
    hasOrganizationCapability,
    hasPublicCapability,
    isAuthorizedExpressionCreator,
  ]);

  const hasAnyMinistryAccess = authenticated && accessReady && (
    access.canCreateOfficialContent ||
    access.canManageCare ||
    access.canManageGiving ||
    access.canReadGivingFinance ||
    access.canManageLeadership ||
    access.canBroadcastLive ||
    access.canManageExpressions
  );

  return {
    authenticated,
    accessReady,
    organizationId,
    hasAnyMinistryAccess,
    ...access,
  };
}
