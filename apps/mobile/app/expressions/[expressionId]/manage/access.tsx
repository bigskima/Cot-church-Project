import React from 'react';
import ExpressionGovernanceScreen from '../../../(tabs)/profile/leadership/expression-governance';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionAccessManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageAccess} expressionId={access.expressionId} title="Team access unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="access"
        title="Team Access & Ownership"
        subtitle="Invite ministry leaders, manage team responsibility and review Expression ownership."
        icon="shield-checkmark-outline"
      >
        <ExpressionGovernanceScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
