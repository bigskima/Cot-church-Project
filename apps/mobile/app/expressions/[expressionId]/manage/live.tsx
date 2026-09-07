import React from 'react';
import MediaStudioScreen from '../../../(tabs)/profile/leadership/media-studio';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionLiveStudioScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageLive} expressionId={access.expressionId} title="Live Studio unavailable">
      <MediaStudioScreen />
    </ExpressionManagementGate>
  );
}
