import React from 'react';
import EventsManageScreen from '../../../(tabs)/profile/leadership/events-manage';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionEventManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageEvents} expressionId={access.expressionId} title="Event management unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="events"
        title="Events"
        subtitle="Plan gatherings, publish event details and keep the Expression calendar current."
        icon="calendar-outline"
      >
        <EventsManageScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
