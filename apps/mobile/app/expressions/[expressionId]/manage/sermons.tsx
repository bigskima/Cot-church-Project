import React from 'react';
import SermonsManageScreen from '../../../(tabs)/profile/leadership/sermons-manage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionSermonManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageSermons} expressionId={access.expressionId} title="Sermon management unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="sermons"
        title="Pastor’s Messages Studio"
        subtitle="Create and publish pastoral audio and video messages for members of this Expression."
        icon="headset-outline"
      >
        <SermonsManageScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
