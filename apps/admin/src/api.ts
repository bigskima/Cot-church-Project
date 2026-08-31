export interface AuthState {
  accessToken: string;
  organizationId?: string;
  branchId?: string;
}

const key = 'church-admin-auth';
const DEFAULT_API_URL = 'https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1';

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
    // SessionStorage fallback
  }
}

export class ApiClient {
  constructor(private getAuth: () => AuthState | null) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const auth = this.getAuth();
    const baseUrl = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    const response = await fetch(`${baseUrl}/${cleanPath}`, {
      ...init,
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
      throw new Error(`Server returned invalid response (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(payload.error?.message || payload.message || 'Request failed');
    }
    return payload.data as T;
  }
}

