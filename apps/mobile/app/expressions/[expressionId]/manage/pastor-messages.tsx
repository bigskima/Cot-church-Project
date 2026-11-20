import React from 'react';
import PastorMessagesManageScreen from '../../../../src/features/media/PastorMessagesManageExperience';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionPastorMessagesManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate
      ready={access.ready}
      allowed={access.canManagePastorMessages}
      expressionId={access.expressionId}
      title="Pastor’s Messages management unavailable"
    >
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="pastor-messages"
        title="Pastor’s Messages Studio"
        subtitle="Create and publish pastoral audio and video messages for members of this Expression."
        icon="headset-outline"
      >
        <PastorMessagesManageScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
