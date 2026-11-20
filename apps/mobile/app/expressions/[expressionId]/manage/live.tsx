import React from 'react';
import MediaStudioScreen from '../../../(tabs)/profile/leadership/media-studio';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionLiveStudioScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageLive} expressionId={access.expressionId} title="Live Studio unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="live"
        title="Live Studio"
        subtitle="Create broadcasts, review readiness and manage active streams for this Expression."
        icon="radio-outline"
      >
        <MediaStudioScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
