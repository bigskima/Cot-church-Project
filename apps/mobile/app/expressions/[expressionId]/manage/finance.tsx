import React from 'react';
import GivingFinanceScreen from '../../../(tabs)/profile/leadership/giving-finance';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionGivingFinanceScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canReadGivingFinance} expressionId={access.expressionId} title="Giving reports unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="finance"
        title="Giving Reports"
        subtitle="Review recent giving totals, refunds and net amounts for this Expression."
        icon="analytics-outline"
      >
        <GivingFinanceScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
