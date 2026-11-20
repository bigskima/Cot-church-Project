import React from 'react';
import InviteCodesScreen from '../../../leadership/invite-codes';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionInviteCodesScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageInviteCodes} expressionId={access.expressionId} title="Invite codes unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="invites"
        title="Invite Codes"
        subtitle="Create time-limited or usage-limited codes for people joining this Expression."
        icon="key-outline"
      >
        <InviteCodesScreen />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
