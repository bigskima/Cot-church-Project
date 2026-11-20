import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FeedRankingSettingsExperience } from '@/features/feed/FeedRankingSettingsExperience';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionFeedRankingScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const routeId = typeof expressionId === 'string' ? expressionId : '';
  const access = useExpressionManagementAccess();
  const id = access.expressionId || routeId;
  return (
    <ExpressionManagementGate ready={access.ready} allowed={Boolean(id) && access.canManageFeedRanking} expressionId={id} title="Content order settings unavailable">
      <ExpressionManagementWorkspace
        expressionId={id}
        active="settings"
        title="Content order"
        subtitle="Choose what appears first in this Expression. These settings do not change who can view posts or how content is moderated."
        icon="analytics-outline"
      >
        <FeedRankingSettingsExperience scope="expression" expressionId={id} />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
