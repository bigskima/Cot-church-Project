import React from 'react';
import SermonsManageScreen from '../../../(tabs)/profile/leadership/sermons-manage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionSermonManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageSermons} expressionId={access.expressionId} title="Sermon management unavailable">
      <SermonsManageScreen />
    </ExpressionManagementGate>
  );
}
