import React from 'react';
import ReelCreatorScreen from '../../../studio/reel';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionReelCreatorScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canPublishExpressionReels} expressionId={access.expressionId} title="Reel publishing unavailable">
      <ReelCreatorScreen />
    </ExpressionManagementGate>
  );
}
