import React from 'react';
import WatchVideoCreatorScreen from '../../../studio/video';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionWatchCreatorScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canPublishExpressionVideos} expressionId={access.expressionId} title="Watch publishing unavailable">
      <WatchVideoCreatorScreen />
    </ExpressionManagementGate>
  );
}
