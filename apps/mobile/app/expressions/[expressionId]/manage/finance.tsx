import React from 'react';
import GivingFinanceScreen from '../../../(tabs)/profile/leadership/giving-finance';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionGivingFinanceScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canReadGivingFinance} expressionId={access.expressionId} title="Giving finance unavailable">
      <GivingFinanceScreen />
    </ExpressionManagementGate>
  );
}
