import React from 'react';
import ExpressionFinanceManagementExperience from '@/features/finance/ExpressionFinanceManagementExperience';
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
        title="Financial management"
        subtitle="Document giving, expenses, sessions and wallet balances for this Expression."
        icon="wallet-outline"
      >
        <ExpressionFinanceManagementExperience />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
