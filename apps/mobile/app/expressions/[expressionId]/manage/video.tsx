import React from 'react';
import WatchVideoCreatorScreen from '../../../studio/video';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionWatchCreatorScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canPublishExpressionVideos} expressionId={access.expressionId} title="Video publishing unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="studio"
        title="Create Video"
        subtitle="Publish long-form media directly into this Expression library."
        icon="videocam-outline"
      >
        <WatchVideoCreatorScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
