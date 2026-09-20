import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { ApiClient } from '@/api';

const TOKEN_KEY = 'cot-expo-push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushDeviceStatus =
  | { state: 'unsupported'; permission: 'unsupported'; token: null }
  | { state: 'disabled'; permission: string; token: null }
  | { state: 'registered'; permission: 'granted'; token: string }
  | { state: 'error'; permission: string; token: null; message: string };

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

function deviceLabel() {
  if (Platform.OS === 'android') return `Android ${String(Platform.Version)}`;
  if (Platform.OS === 'ios') return `iOS ${String(Platform.Version)}`;
  return Platform.OS;
}

export async function configurePushChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('cot-default', {
      name: 'COT notifications',
      description: 'Church updates, messages, mentions and reminders from COT.',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
      showBadge: true,
    }),
    Notifications.setNotificationChannelAsync('cot-calls', {
      name: 'Incoming COT calls',
      description: 'Audio and video call alerts from COT chats.',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 450, 220, 450, 220, 450],
      showBadge: true,
    }),
    Notifications.setNotificationChannelAsync('cot-silent', {
      name: 'COT quiet notifications',
      description: 'COT notifications without sound.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      vibrationPattern: null,
      showBadge: true,
    }),
  ]);
}

export async function currentPushPermission() {
  if (Platform.OS === 'web') return { granted: false, status: 'unsupported' };
  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  return { granted, status: permission.status };
}

export async function storedPushToken() {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
}

async function persistToken(token: string | null) {
  if (Platform.OS === 'web') return;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

export async function registerPushDevice(api: ApiClient, requestPermission = true): Promise<PushDeviceStatus> {
  if (Platform.OS === 'web') return { state: 'unsupported', permission: 'unsupported', token: null };
  try {
    await configurePushChannels();
    let permission = await Notifications.getPermissionsAsync();
    let granted = permission.granted
      || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted && requestPermission) {
      permission = await Notifications.requestPermissionsAsync();
      granted = permission.granted
        || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }

    if (!granted) {
      await persistToken(null);
      return { state: 'disabled', permission: permission.status, token: null };
    }

    const easProjectId = projectId();
    if (!easProjectId) {
      return { state: 'error', permission: permission.status, token: null, message: 'COT push project configuration is unavailable.' };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    await api.request('notification-settings', {
      method: 'POST',
      body: JSON.stringify({
        expoPushToken: token,
        platform: Platform.OS,
        deviceName: deviceLabel(),
      }),
      feedback: false,
    });
    await persistToken(token);
    return { state: 'registered', permission: 'granted', token };
  } catch (error) {
    return {
      state: 'error',
      permission: (await currentPushPermission().catch(() => ({ status: 'unknown' }))).status,
      token: null,
      message: error instanceof Error ? error.message : 'Unable to enable push notifications on this device.',
    };
  }
}

export async function syncPushDeviceIfGranted(api: ApiClient) {
  if (Platform.OS === 'web') return;
  const permission = await currentPushPermission().catch(() => ({ granted: false, status: 'unknown' }));
  if (!permission.granted) return;
  await registerPushDevice(api, false);
}

export async function deactivateStoredPushDevice(api: ApiClient) {
  if (Platform.OS === 'web') return;
  const token = await storedPushToken();
  if (!token) return;
  try {
    await api.request('notification-settings', {
      method: 'DELETE',
      body: JSON.stringify({ expoPushToken: token }),
      feedback: false,
    });
  } finally {
    await persistToken(null);
  }
}

export async function pushDeviceStatus(): Promise<PushDeviceStatus> {
  if (Platform.OS === 'web') return { state: 'unsupported', permission: 'unsupported', token: null };
  try {
    const permission = await currentPushPermission();
    const token = await storedPushToken();
    if (permission.granted && token) return { state: 'registered', permission: 'granted', token };
    if (!permission.granted) return { state: 'disabled', permission: permission.status, token: null };
    return { state: 'disabled', permission: permission.status, token: null };
  } catch (error) {
    return { state: 'error', permission: 'unknown', token: null, message: error instanceof Error ? error.message : 'Unable to check push status.' };
  }
}

export function safeNotificationRoute(data: Record<string, unknown> | null | undefined) {
  const route = typeof data?.route === 'string' ? data.route.trim() : '';
  return route.startsWith('/') && !route.startsWith('//') ? route : '/general/notifications';
}

export async function clearLastPushResponse() {
  await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
}

export { Notifications };
