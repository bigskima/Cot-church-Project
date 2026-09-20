import { useMemo } from 'react';
import { useResource } from '@/hooks/use-resource';
import { useSession } from '@/state/session';

export type FeatureAccessItem = {
  key: string;
  name: string;
  category: string;
  effectiveEnabled: boolean;
  directEnabled: boolean;
  inheritedFrom: 'global' | 'organization' | 'expression' | 'group';
  blockedBy?: string | null;
  scopes?: string[];
};

type FeatureAccessPayload = {
  scope: {
    organizationId?: string | null;
    expressionId?: string | null;
    groupId?: string | null;
  };
  items: FeatureAccessItem[];
};

export function useFeatureControls(input: {
  organizationId?: string | null;
  expressionId?: string | null;
  groupId?: string | null;
} = {}) {
  const { api, context } = useSession();
  const organizationId =
    input.organizationId ??
    context?.organization?.id ??
    context?.organizations?.[0]?.id ??
    process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
    '';
  const expressionId = input.expressionId ?? context?.expression?.id ?? '';
  const groupId = input.groupId ?? '';

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (expressionId) params.set('expressionId', expressionId);
    if (groupId) params.set('groupId', groupId);
    const value = params.toString();
    return value ? `noop?service=feature-access&${value}` : 'noop?service=feature-access';
  }, [expressionId, groupId, organizationId]);

  const resource = useResource<FeatureAccessPayload>(
    `feature-access:${organizationId || 'global'}:${expressionId || 'general'}:${groupId || 'none'}`,
    (signal) => api.request<FeatureAccessPayload>(query, { signal, context: expressionId ? 'current' : 'public', feedback: false }),
  );

  const map = useMemo(
    () => new Map((resource.data?.items ?? []).map((item) => [item.key, item])),
    [resource.data?.items],
  );

  const isEnabled = (key: string) => {
    const item = map.get(key);
    // Availability controls fail open in the UI while configuration is loading or
    // temporarily unreachable. Server-side guards remain authoritative for writes.
    return item ? item.effectiveEnabled : true;
  };

  return {
    ...resource,
    organizationId,
    expressionId,
    groupId,
    items: resource.data?.items ?? [],
    isEnabled,
    get: (key: string) => map.get(key),
  };
}
