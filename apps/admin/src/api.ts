export interface AuthState {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  organizationId?: string;
  branchId?: string;
}

const key = 'church-admin-auth';
const REQUEST_TIMEOUT_MS = 15_000;
const REFRESH_SKEW_SECONDS = 120;

function isAuthState(value: unknown): value is AuthState {
  if (!value || typeof value !== 'object') return false;
  const auth = value as Partial<AuthState>;
  return typeof auth.accessToken === 'string' && auth.accessToken.trim().length > 0;
}

export function loadAuth(): AuthState | null {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (isAuthState(parsed)) return parsed;
    sessionStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

export function saveAuth(value: AuthState | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch {
    // Session storage is a convenience only; authentication should still render.
  }
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const INTERNAL_COPY_PATTERN = /\b(api|webhook|runtime|secret|provider|adapter|configuration|configured|backend|platform authority|control plane|rls|jwt|supabase|database|sql)\b/i;

function configuredApiUrl() {
  return String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
}

function sessionNeedsRefresh(auth: AuthState | null) {
  if (!auth?.refreshToken) return false;
  if (!auth.expiresAt) return true;
  return auth.expiresAt <= Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS;
}

function adminMessage(code: string, status: number, message?: string) {
  if (code === 'API_NOT_CONFIGURED') return 'Platform Administration is temporarily unavailable. Please try again later.';
  if (code === 'NETWORK_ERROR') return 'We couldn’t connect to Platform Administration. Check your connection and try again.';
  if (code === 'REQUEST_TIMEOUT') return 'This request is taking longer than expected. Please try again.';
  if (code === 'INVALID_REFRESH_SESSION' || code === 'INVALID_ACCESS_TOKEN' || status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You don’t have access to this action.';
  if (status === 404) return message && !INTERNAL_COPY_PATTERN.test(message) ? message : 'The requested record could not be found.';
  if (status >= 500) return 'Something went wrong while loading this page. Please try again.';
  return message && !INTERNAL_COPY_PATTERN.test(message) ? message : 'We couldn’t complete this request. Please try again.';
}

export class ApiClient {
  private refreshPromise: Promise<AuthState | null> | null = null;

  constructor(
    private getAuth: () => AuthState | null,
    private updateAuth?: (value: AuthState | null) => void,
  ) {}

  private async refreshAuth(baseUrl: string, current: AuthState) {
    if (!current.refreshToken) return current;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${baseUrl}/refresh-session`, {
          method: 'POST',
          signal: controller.signal,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.data?.session?.accessToken) {
          if (response.status === 401) this.updateAuth?.(null);
          throw new ApiError(
            payload?.error?.code ?? 'INVALID_REFRESH_SESSION',
            adminMessage(payload?.error?.code ?? 'INVALID_REFRESH_SESSION', response.status, payload?.error?.message),
            response.status,
          );
        }

        const session = payload.data.session;
        const refreshed: AuthState = {
          ...current,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken ?? current.refreshToken,
          expiresAt: session.expiresAt,
          tokenType: session.tokenType ?? 'bearer',
        };
        this.updateAuth?.(refreshed);
        return refreshed;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiError('REQUEST_TIMEOUT', adminMessage('REQUEST_TIMEOUT', 0), 0);
        }
        throw new ApiError('NETWORK_ERROR', adminMessage('NETWORK_ERROR', 0), 0);
      } finally {
        window.clearTimeout(timer);
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = configuredApiUrl();
    if (!baseUrl) {
      throw new ApiError('API_NOT_CONFIGURED', adminMessage('API_NOT_CONFIGURED', 0), 0);
    }

    let auth = this.getAuth();
    if (auth && sessionNeedsRefresh(auth)) auth = await this.refreshAuth(baseUrl, auth);

    const cleanPath = path.replace(/^\/+/, '');
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const callerSignal = init.signal;
    const cancelFromCaller = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', cancelFromCaller, { once: true });
    }

    try {
      const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
      const response = await fetch(`${baseUrl}/${cleanPath}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
          ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
          ...(auth?.organizationId ? { 'X-Organization-Id': auth.organizationId } : {}),
          ...(auth?.branchId ? { 'X-Branch-Id': auth.branchId } : {}),
          ...init.headers,
        },
      });

      let payload: any = {};
      try {
        payload = await response.json();
      } catch {
        throw new ApiError('INVALID_RESPONSE', adminMessage('INVALID_RESPONSE', response.status), response.status);
      }

      if (!response.ok) {
        const code = payload.error?.code ?? 'REQUEST_FAILED';
        if (response.status === 401) this.updateAuth?.(null);
        throw new ApiError(code, adminMessage(code, response.status, payload.error?.message ?? payload.message), response.status);
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) throw new ApiError('REQUEST_TIMEOUT', adminMessage('REQUEST_TIMEOUT', 0), 0);
        throw new ApiError('REQUEST_CANCELLED', 'The request was cancelled.', 0);
      }
      throw new ApiError('NETWORK_ERROR', adminMessage('NETWORK_ERROR', 0), 0);
    } finally {
      window.clearTimeout(timer);
      callerSignal?.removeEventListener('abort', cancelFromCaller);
    }
  }
}
