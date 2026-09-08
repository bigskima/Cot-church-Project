import React from 'react';
import ReelCreatorScreen from '../../../studio/reel';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionReelCreatorScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canPublishExpressionReels} expressionId={access.expressionId} title="Reel publishing unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="studio"
        title="Create Reel"
        subtitle="Publish a short vertical video directly into this Expression."
        icon="flash-outline"
      >
        <ReelCreatorScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
