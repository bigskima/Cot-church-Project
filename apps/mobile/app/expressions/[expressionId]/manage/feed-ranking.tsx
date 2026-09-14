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
    <ExpressionManagementGate ready={access.ready} allowed={Boolean(id) && access.canManageFeedRanking} expressionId={id} title="Feed ranking controls unavailable">
      <ExpressionManagementWorkspace
        expressionId={id}
        active="settings"
        title="Feed Ranking"
        subtitle="Tune an explainable ranking model for this Expression without changing content visibility or moderation."
        icon="analytics-outline"
      >
        <FeedRankingSettingsExperience scope="expression" expressionId={id} />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
