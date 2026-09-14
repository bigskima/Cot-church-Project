import React from 'react';
import AnnouncementsManageExperience from '@/features/announcements/AnnouncementsManageExperience';
import { ExpressionManagementGate } from '@/features/expression-management/ExpressionManagementGate';
import { ExpressionManagementWorkspace } from '@/features/expression-management/ExpressionManagementWorkspace';
import { useExpressionManagementAccess } from '@/features/expression-management/useExpressionManagementAccess';

export default function ExpressionAnnouncementManagementScreen() {
  const access = useExpressionManagementAccess();
  return (
    <ExpressionManagementGate ready={access.ready} allowed={access.canManageAnnouncements} expressionId={access.expressionId} title="Announcement management unavailable">
      <ExpressionManagementWorkspace
        expressionId={access.expressionId}
        active="announcements"
        title="Announcements"
        subtitle="Publish official Expression updates with optional banners and scheduled delivery."
        icon="megaphone-outline"
      >
        <AnnouncementsManageExperience />
      </ExpressionManagementWorkspace>
    </ExpressionManagementGate>
  );
}
