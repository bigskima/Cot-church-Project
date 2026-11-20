import React from 'react';
import ExpressionTestimonyExperience from '@/features/testimonies/ExpressionTestimonyExperience';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionTestimonyManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canReviewTestimonies} expressionId={access.expressionId} title="Testimony review unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="testimonies"
        title="Testimony review"
        subtitle="Respond privately, invite members to share in service and record the ministry outcome."
        icon="document-text-outline"
      >
        <ExpressionTestimonyExperience managed />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
