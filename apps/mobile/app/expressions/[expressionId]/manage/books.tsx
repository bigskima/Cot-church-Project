import React from 'react';
import ExpressionFinanceManagementV2 from '@/features/finance/ExpressionFinanceManagementV2';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionFinanceManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canReadExpressionFinance} expressionId={access.expressionId} title="Expression finance unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="books"
        title="Finance"
        subtitle="See total giving first, then add optional member-level detail, expenses and reconciliation."
        icon="wallet-outline"
      >
        <ExpressionFinanceManagementV2 />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
