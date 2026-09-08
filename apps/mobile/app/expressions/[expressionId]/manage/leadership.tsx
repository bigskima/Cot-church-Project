import React from 'react';
import ExpressionLeadershipManage from '../../../(tabs)/profile/leadership/expression-leadership';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionLeadershipManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageLeadership} expressionId={access.expressionId} title="Leadership management unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="leadership"
        title="Leadership"
        subtitle="Maintain the leaders and ministry contacts presented to members in this Expression."
        icon="people-circle-outline"
      >
        <ExpressionLeadershipManage />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
