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

function isStoredAuth(value: unknown): value is StoredAuth {
  if (!value || typeof value !== 'object') return false;
  const session = (value as Partial<StoredAuth>).session;
  return Boolean(
    session
      && typeof session.accessToken === 'string'
      && session.accessToken.trim()
      && typeof session.refreshToken === 'string'
      && session.refreshToken.trim(),
  );
}

function parseStoredAuth(value: string | null): StoredAuth | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  return isStoredAuth(parsed) ? parsed : null;
}

export async function loadAuth(): Promise<StoredAuth | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(SESSION_KEY);
        const parsed = parseStoredAuth(value);
        if (value && !parsed) window.localStorage.removeItem(SESSION_KEY);
        return parsed;
      }
      return null;
    }
    const isAvailable = await SecureStore.isAvailableAsync().catch(() => false);
    if (!isAvailable) return null;
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    const parsed = parseStoredAuth(value);
    if (value && !parsed) await SecureStore.deleteItemAsync(SESSION_KEY);
    return parsed;
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
    this.name = 'ApiError';
  }
}

const INTERNAL_COPY_PATTERN = /\b(api|webhook|runtime|secret|provider|adapter|configuration|configured|backend|platform authority|control plane|rls|jwt|supabase)\b/i;

function userFacingApiMessage(code: string, status: number, serverMessage?: string) {
  const known: Record<string, string> = {
    API_NOT_CONFIGURED: 'This feature is temporarily unavailable. Please try again later.',
    NETWORK_ERROR: 'We couldn’t connect. Check your internet connection and try again.',
    REQUEST_TIMEOUT: 'This is taking longer than expected. Please try again.',
    INVALID_RESPONSE: 'We couldn’t load this right now. Please try again.',
    AUTHENTICATION_REQUIRED: 'Please sign in to continue.',
    INVALID_CREDENTIALS: 'The email, phone number, or password you entered is incorrect.',
    INVALID_OTP: 'That verification code is invalid or has expired.',
    USERNAME_TAKEN: 'That username is already in use. Choose another one.',
    INVALID_ACCESS_TOKEN: 'Your session has expired. Please sign in again.',
    INVALID_REFRESH_SESSION: 'Your session has expired. Please sign in again.',
    REFRESH_TOKEN_MISSING: 'Your session has expired. Please sign in again.',
    PERMISSION_DENIED: 'You don’t have access to this action.',
    PLATFORM_PERMISSION_DENIED: 'You don’t have access to this action.',
    EXPRESSION_REQUIRED: 'Enter an Expression to continue.',
    EXPRESSION_MEMBERSHIP_REQUIRED: 'Join this Expression before accessing its private space.',
    GENERAL_POSTING_MEMBERSHIP_REQUIRED: 'Join an active Expression before posting in General Community.',
    GENERAL_MEDIA_RESTRICTED: 'General Community member posts support text, photos and short videos only.',
    GENERAL_VIDEO_TOO_LONG: 'General Community videos must be 3 minutes or shorter.',
    EXPRESSION_ACCESS_DENIED: 'You don’t have access to this Expression.',
    EXPRESSION_INVITE_INVALID: 'That invite code is invalid or no longer available.',
    EXPRESSION_INVITE_UNAVAILABLE: 'That invite code has expired or reached its usage limit.',
    REGISTRATION_ACCESS_DENIED: 'You are not eligible to register for this event.',
    REGISTRATION_UNAVAILABLE: 'Registration is not available for this event.',
    REGISTRATION_NOT_FOUND: 'No active registration was found.',
    REGISTRATION_CANCEL_FAILED: 'We couldn’t cancel your registration. Please try again.',
    ONLINE_GIVING_UNAVAILABLE: 'Online giving is not available for this giving destination yet.',
    ONLINE_GIVING_NOT_READY: 'Online giving is not available for this giving destination yet.',
    AI_ASSISTANT_NOT_READY: 'The church assistant is temporarily unavailable. Please try again later.',
    STREAMING_CONFIGURATION_MISSING: 'Live broadcasting is temporarily unavailable. Please try again later.',
    STREAM_PROVIDER_NOT_CONFIGURED: 'Live broadcasting is temporarily unavailable. Please try again later.',
  };

  if (known[code]) return known[code];
  if (status >= 500) return 'Something went wrong while loading this. Please try again.';
  if (status === 404) return serverMessage && !INTERNAL_COPY_PATTERN.test(serverMessage)
    ? serverMessage
    : 'The requested item could not be found.';
  if (status === 403) return serverMessage && !INTERNAL_COPY_PATTERN.test(serverMessage)
    ? serverMessage
    : 'You don’t have access to this action.';
  if (status === 401) return 'Please sign in again to continue.';
  if (serverMessage && !INTERNAL_COPY_PATTERN.test(serverMessage)) return serverMessage;
  return 'We couldn’t complete this request. Please try again.';
}

export class ApiClient {
  constructor(private baseUrl: string, private getAuth: () => StoredAuth | null) {}

  async request<T>(path: string, init: RequestInit & { context?: 'current' | 'public' } = {}) {
    const cleanBase = this.baseUrl.trim().replace(/\/+$/, '');
    if (!cleanBase) {
      throw new ApiError('API_NOT_CONFIGURED', userFacingApiMessage('API_NOT_CONFIGURED', 0), 0);
    }

    const auth = this.getAuth();
    const { context: requestContext = 'current', ...fetchInit } = init;
    const cleanPath = path.replace(/^\/+/, '');
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DEFAULT_REQUEST_TIMEOUT_MS);

    const callerSignal = fetchInit.signal;
    const abortFromCaller = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      const isFormData = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
      const response = await fetch(`${cleanBase}/${cleanPath}`, {
        ...fetchInit,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          // Never set multipart Content-Type manually: fetch must add the boundary.
          ...(fetchInit.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
          ...(auth?.session?.accessToken ? { Authorization: `Bearer ${auth.session.accessToken}` } : {}),
          ...(requestContext === 'current' && auth?.organizationId ? { 'X-Organization-Id': auth.organizationId } : {}),
          ...(requestContext === 'current' && auth?.branchId ? { 'X-Branch-Id': auth.branchId } : {}),
          ...fetchInit.headers,
        },
      });

      let payload: any = {};
      try {
        payload = await response.json();
      } catch {
        throw new ApiError('INVALID_RESPONSE', userFacingApiMessage('INVALID_RESPONSE', response.status), response.status);
      }

      if (!response.ok) {
        const code = payload.error?.code ?? 'REQUEST_FAILED';
        throw new ApiError(code, userFacingApiMessage(code, response.status, payload.error?.message), response.status);
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) throw new ApiError('REQUEST_TIMEOUT', userFacingApiMessage('REQUEST_TIMEOUT', 0), 0);
        throw new ApiError('REQUEST_CANCELLED', 'The request was cancelled.', 0);
      }
      throw new ApiError('NETWORK_ERROR', userFacingApiMessage('NETWORK_ERROR', 0), 0);
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

// Runtime endpoint configuration is deployment-owned. Do not hardcode a Supabase
// project URL in the client bundle; previews, staging and production may differ.
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
