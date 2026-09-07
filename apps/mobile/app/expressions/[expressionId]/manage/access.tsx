import React from 'react';
import ExpressionGovernanceScreen from '../../../(tabs)/profile/leadership/expression-governance';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionAccessManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageAccess} expressionId={access.expressionId} title="Roles and ownership unavailable">
      <ExpressionGovernanceScreen />
    </ExpressionManagementGate>
  );
}
