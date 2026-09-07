import React from 'react';
import GivingManageScreen from '../../../(tabs)/profile/leadership/giving-manage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionGivingManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageGiving} expressionId={access.expressionId} title="Giving configuration unavailable">
      <GivingManageScreen />
    </ExpressionManagementGate>
  );
}
