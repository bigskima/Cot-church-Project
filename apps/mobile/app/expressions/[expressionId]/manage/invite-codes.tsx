import React from 'react';
import InviteCodesScreen from '../../../leadership/invite-codes';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionInviteCodesScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageInviteCodes} expressionId={access.expressionId} title="Invite codes unavailable">
      <InviteCodesScreen />
    </ExpressionManagementGate>
  );
}
