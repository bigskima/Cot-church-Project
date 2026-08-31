import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'church-os-session';
const DEFAULT_API_URL = 'https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  tokenType: string;
}

export interface StoredAuth {
  session: Session;
  organizationId?: string;
  branchId?: string;
}

export async function loadAuth(): Promise<StoredAuth | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(SESSION_KEY);
        return value ? (JSON.parse(value) as StoredAuth) : null;
      }
      return null;
    }
    const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
    if (!isAvailable) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(SESSION_KEY);
        return value ? (JSON.parse(value) as StoredAuth) : null;
      }
      return null;
    }
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    return value ? (JSON.parse(value) as StoredAuth) : null;
  } catch (err) {
    console.warn('loadAuth failed gracefully:', err);
    return null;
  }
}

export async function saveAuth(value: StoredAuth | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (value) window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
        else window.localStorage.removeItem(SESSION_KEY);
      }
      return;
    }
    const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
    if (!isAvailable) {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (value) window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
        else window.localStorage.removeItem(SESSION_KEY);
      }
      return;
    }
    if (value) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch (err) {
    console.warn('saveAuth failed gracefully:', err);
  }
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export class ApiClient {
  constructor(private baseUrl: string, private getAuth: () => StoredAuth | null) {}

  async request<T>(path: string, init: RequestInit = {}) {
    const auth = this.getAuth();
    const cleanBase = (this.baseUrl || DEFAULT_API_URL).replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    const response = await fetch(`${cleanBase}/${cleanPath}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth?.session?.accessToken ? { Authorization: `Bearer ${auth.session.accessToken}` } : {}),
        ...(auth?.organizationId ? { 'X-Organization-Id': auth.organizationId } : {}),
        ...(auth?.branchId ? { 'X-Branch-Id': auth.branchId } : {}),
        ...init.headers,
      },
    });

    let payload: any = {};
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('INVALID_RESPONSE', `Server returned invalid response (${response.status})`, response.status);
    }

    if (!response.ok) {
      throw new ApiError(payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'Request failed', response.status);
    }
    return payload.data as T;
  }
}

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

