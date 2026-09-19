import React from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useSession } from '@/state/session';
import { Notifications, clearLastPushResponse, safeNotificationRoute, syncPushDeviceIfGranted } from '@/services/push-notifications';

export function PushNotificationsBridge() {
  const { api, mode, accessReady, auth, context, selectContext } = useSession();
  const handling = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (Platform.OS === 'web' || mode !== 'authenticated' || !accessReady || !context?.organization?.id) return;
    void syncPushDeviceIfGranted(api);
  }, [accessReady, api, context?.organization?.id, mode]);

  const openResponse = React.useCallback(async (response: Notifications.NotificationResponse | null) => {
    if (!response?.notification || mode !== 'authenticated') return;
    const requestId = response.notification.request.identifier;
    if (handling.current.has(requestId)) return;
    handling.current.add(requestId);
    try {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const route = safeNotificationRoute(data);
      const notificationId = typeof data.notificationId === 'string' ? data.notificationId : '';
      const branchId = typeof data.branchId === 'string' ? data.branchId : '';
      const organizationId = typeof data.organizationId === 'string'
        ? data.organizationId
        : (context?.organization?.id ?? auth?.organizationId ?? '');

      if (branchId && organizationId && context?.expression?.id !== branchId) {
        await selectContext(organizationId, branchId);
      } else if (!branchId && organizationId && context?.expression?.id) {
        await selectContext(organizationId);
      }

      if (notificationId) {
        await api.request('notifications', {
          method: 'PATCH',
          context: branchId ? 'current' : 'public',
          body: JSON.stringify({ id: notificationId, read: true }),
          feedback: false,
        }).catch(() => undefined);
      }
      router.push(route as any);
    } finally {
      await clearLastPushResponse();
      handling.current.delete(requestId);
    }
  }, [api, auth?.organizationId, context?.expression?.id, context?.organization?.id, mode, selectContext]);

  React.useEffect(() => {
    if (Platform.OS === 'web' || mode !== 'authenticated' || !accessReady) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openResponse(response);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => openResponse(response)).catch(() => undefined);
    return () => subscription.remove();
  }, [accessReady, mode, openResponse]);

  return null;
}
