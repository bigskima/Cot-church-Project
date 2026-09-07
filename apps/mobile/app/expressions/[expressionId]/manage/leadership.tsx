import React from 'react';
import ExpressionLeadershipManage from '../../../(tabs)/profile/leadership/expression-leadership';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionLeadershipManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageLeadership} expressionId={access.expressionId} title="Leadership management unavailable">
      <ExpressionLeadershipManage />
    </ExpressionManagementGate>
  );
}
