import React from 'react';
import PastoralTriageScreen from '../../../leadership/pastoral-triage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionPrayerInboxScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManagePrayer} expressionId={access.expressionId} title="Prayer inbox unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="prayer"
        title="Prayer inbox"
        subtitle="Prayer leaders see only requests routed to their role in this Expression."
        icon="heart-outline"
      >
        <PastoralTriageScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
