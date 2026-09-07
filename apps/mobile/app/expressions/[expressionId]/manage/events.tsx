import React from 'react';
import EventsManageScreen from '../../../(tabs)/profile/leadership/events-manage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionEventManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageEvents} expressionId={access.expressionId} title="Event management unavailable">
      <EventsManageScreen />
    </ExpressionManagementGate>
  );
}
