import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'church-os-session';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

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
    if (!isAvailable) return;

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
    const cleanBase = this.baseUrl.trim().replace(/\/+$/, '');
    if (!cleanBase) {
      throw new ApiError(
        'API_NOT_CONFIGURED',
        'This application build is missing EXPO_PUBLIC_API_URL.',
        0
      );
    }

    const auth = this.getAuth();
    const cleanPath = path.replace(/^\/+/, '');
    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DEFAULT_REQUEST_TIMEOUT_MS);

    const callerSignal = init.signal;
    const abortFromCaller = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      const response = await fetch(`${cleanBase}/${cleanPath}`, {
        ...init,
        signal: controller.signal,
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
        throw new ApiError(
          'INVALID_RESPONSE',
          `Server returned invalid response (${response.status})`,
          response.status
        );
      }

      if (!response.ok) {
        throw new ApiError(
          payload.error?.code ?? 'REQUEST_FAILED',
          payload.error?.message ?? 'Request failed',
          response.status
        );
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) {
          throw new ApiError('REQUEST_TIMEOUT', 'The server took too long to respond. Please try again.', 0);
        }
        throw new ApiError('REQUEST_CANCELLED', 'The request was cancelled.', 0);
      }
      throw new ApiError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unable to reach the server.',
        0
      );
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

// Runtime endpoint configuration is deployment-owned. Do not hardcode a Supabase
// project URL in the client bundle; previews, staging and production may differ.
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
