import React from 'react';
import { ExpressionContentStudio } from '@/features/expression-management/ExpressionContentStudio';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionStudioScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate
      ready={access.ready}
      allowed={access.canUseContentStudio}
      expressionId={access.expressionId}
      title="Content Studio unavailable"
    >
      <ExpressionContentStudio />
    </ExpressionManagementGate>
  );
}
