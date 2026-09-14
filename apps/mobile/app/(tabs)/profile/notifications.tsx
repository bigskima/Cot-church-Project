import React from 'react';
import { NotificationsExperience } from '@/features/notifications/NotificationsExperience';
import { useSession } from '@/state/session';

export default function NotificationsScreen() {
  const { api } = useSession();

  const respondToInvitation = async (invitation: { id: string }, decision: 'accept' | 'decline') => {
    await api.request('governance-invitations', {
      method: 'POST',
      body: JSON.stringify({ invitationId: invitation.id, decision }),
    });
  };

  const markNotificationRead = async (item: { id: string }) => {
    await api.request('notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id: item.id, read: true }),
    });
  };

  return (
    <NotificationsExperience
      onRespondInvitation={respondToInvitation}
      onMarkNotificationRead={markNotificationRead}
    />
  );
}
