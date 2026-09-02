export interface AuthState {
  accessToken: string;
  organizationId?: string;
  branchId?: string;
}

const key = 'church-admin-auth';
const REQUEST_TIMEOUT_MS = 15_000;

export function loadAuth(): AuthState | null {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as AuthState) : null;
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
  }
}

function configuredApiUrl() {
  return String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
}

export class ApiClient {
  constructor(private getAuth: () => AuthState | null) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = configuredApiUrl();
    if (!baseUrl) {
      throw new ApiError(
        'API_NOT_CONFIGURED',
        'The Platform Admin deployment is missing VITE_API_URL.',
        0,
      );
    }

    const auth = this.getAuth();
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
      const response = await fetch(`${baseUrl}/${cleanPath}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
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
        throw new ApiError(
          'INVALID_RESPONSE',
          `Server returned invalid response (${response.status})`,
          response.status,
        );
      }

      if (!response.ok) {
        throw new ApiError(
          payload.error?.code ?? 'REQUEST_FAILED',
          payload.error?.message ?? payload.message ?? 'Request failed',
          response.status,
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
        error instanceof Error ? error.message : 'Unable to reach the platform API.',
        0,
      );
    } finally {
      window.clearTimeout(timer);
      callerSignal?.removeEventListener('abort', cancelFromCaller);
    }
  }
}
