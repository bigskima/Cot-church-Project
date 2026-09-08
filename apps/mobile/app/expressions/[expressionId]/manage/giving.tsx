import React from 'react';
import GivingManageScreen from '../../../(tabs)/profile/leadership/giving-manage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionGivingManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageGiving} expressionId={access.expressionId} title="Giving setup unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="giving"
        title="Giving Setup"
        subtitle="Configure how members give inside this Expression without changing church-wide giving."
        icon="gift-outline"
      >
        <GivingManageScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
