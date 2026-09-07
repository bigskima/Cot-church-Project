import { useMemo } from 'react';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';

type OwnershipState = {
  isCurrentOwner?: boolean;
} | null;

export function useExpressionManagementAccess() {
  const {
    api,
    context,
    accessReady,
    hasCapability,
  } = useSession();

  const expressionId = context?.expression?.id ?? '';

  const ownership = useResource<OwnershipState>(
    `expression:management:ownership:${expressionId || 'none'}`,
    (signal) =>
      expressionId
        ? api.request<OwnershipState>('expression-ownership', { signal }).catch(() => null)
        : Promise.resolve(null),
  );

  const isCurrentOwner = ownership.data?.isCurrentOwner === true;
  const ownershipReady = !expressionId || !ownership.loading;
  const ready = accessReady && ownershipReady;

  const canManageLive = Boolean(expressionId) && hasCapability('streams.broadcast');
  const canManageSermons =
    Boolean(expressionId) &&
    (hasCapability('sermons.create') ||
      hasCapability('sermons.manage') ||
      hasCapability('sermons.publish'));
  const canManageEvents =
    Boolean(expressionId) &&
    (hasCapability('events.create') || hasCapability('events.update'));
  const canManageGiving =
    Boolean(expressionId) && hasCapability('giving.campaigns.manage');
  const canReadGivingFinance =
    Boolean(expressionId) && hasCapability('giving.finance.read');
  const canManageLeadership =
    Boolean(expressionId) && hasCapability('expression.leadership.manage');
  const canManageSettings =
    Boolean(expressionId) && hasCapability('branches.update');
  const canManageInviteCodes =
    Boolean(expressionId) && hasCapability('members.invite');
  const canManageRoleInvitations =
    Boolean(expressionId) &&
    hasCapability('members.invite') &&
    hasCapability('roles.assign');
  const canManageAccess =
    Boolean(expressionId) && (isCurrentOwner || canManageRoleInvitations);
  const canPublishExpressionPosts =
    Boolean(expressionId) &&
    (hasCapability('posts.create') || hasCapability('posts.publish'));
  const canPublishExpressionReels =
    Boolean(expressionId) &&
    hasCapability('media.upload') &&
    hasCapability('reels.publish');
  const canPublishExpressionVideos =
    Boolean(expressionId) &&
    hasCapability('media.upload') &&
    hasCapability('videos.publish');

  const canUseContentStudio =
    canPublishExpressionPosts ||
    canPublishExpressionReels ||
    canPublishExpressionVideos ||
    canManageSermons;

  const canManageAny = useMemo(
    () =>
      canUseContentStudio ||
      canManageLive ||
      canManageEvents ||
      canManageGiving ||
      canReadGivingFinance ||
      canManageLeadership ||
      canManageSettings ||
      canManageInviteCodes ||
      canManageAccess,
    [
      canManageAccess,
      canManageEvents,
      canManageGiving,
      canManageInviteCodes,
      canManageLeadership,
      canManageSettings,
      canManageLive,
      canManageSermons,
      canReadGivingFinance,
      canUseContentStudio,
    ],
  );

  return {
    expressionId,
    ready,
    ownershipLoading: ownership.loading,
    isCurrentOwner,
    canManageAny,
    canManageLive,
    canManageSermons,
    canManageEvents,
    canManageGiving,
    canReadGivingFinance,
    canManageLeadership,
    canManageSettings,
    canManageInviteCodes,
    canManageRoleInvitations,
    canManageAccess,
    canPublishExpressionPosts,
    canPublishExpressionReels,
    canPublishExpressionVideos,
    canUseContentStudio,
  };
}
