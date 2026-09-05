import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ApiClient, ApiError, apiUrl, loadAuth, saveAuth, type StoredAuth } from '../api';
import type { MembershipContext } from '../types/content';
import { invalidate } from '../services/query-cache';

type Mode = 'restoring' | 'visitor' | 'authenticated';
type Value = {
  auth: StoredAuth | null;
  mode: Mode;
  context: MembershipContext | null;
  permissions: string[];
  hasCapability: (code: string) => boolean;
  api: ApiClient;
  authenticate: (value: StoredAuth) => Promise<void>;
  setSession: (session: any) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  continueAsVisitor: () => Promise<void>;
  enterAsVisitor: () => Promise<void>;
  selectContext: (organizationId: string, branchId?: string) => Promise<void>;
  enterExpression: (organizationId: string, expressionId: string) => Promise<void>;
  leaveExpression: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type RefreshSessionPayload = {
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: number;
    tokenType?: string;
  };
};

const SessionContext = createContext<Value | null>(null);
const REFRESH_SKEW_SECONDS = 120;

function clearContextResources() {
  for (const prefix of ['expression:', 'mobile:home-feed:', 'mobile:community:', 'live:discovery:', 'watch:catalogue:', 'reels:immersive:']) {
    invalidate(prefix);
  }
}

function sessionNeedsRefresh(value: StoredAuth) {
  const expiresAt = value.session.expiresAt;
  if (!expiresAt) return true;
  return expiresAt <= Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS;
}

async function refreshStoredSession(value: StoredAuth): Promise<StoredAuth> {
  if (!value.session.refreshToken) {
    throw new ApiError('REFRESH_TOKEN_MISSING', 'Your session has expired. Please sign in again.', 401);
  }

  // Refresh is intentionally performed through a dedicated public Edge Function.
  // The refresh token is validated by Supabase Auth server-side and is never
  // exposed as a public client key or embedded Supabase credential.
  const refreshApi = new ApiClient(apiUrl, () => null);
  const result = await refreshApi.request<RefreshSessionPayload>('refresh-session', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: value.session.refreshToken }),
  });

  return {
    ...value,
    session: {
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresAt: result.session.expiresAt,
      tokenType: result.session.tokenType || 'bearer',
    },
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [mode, setMode] = useState<Mode>('restoring');
  const [context, setContext] = useState<MembershipContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const stored = await loadAuth();
        if (!stored) {
          if (!cancelled) {
            setAuth(null);
            setMode('visitor');
          }
          return;
        }

        let next = stored;
        if (sessionNeedsRefresh(stored)) {
          try {
            next = await refreshStoredSession(stored);
            await saveAuth(next);
          } catch (error) {
            // A rejected refresh token means the stored login can no longer be
            // trusted. Network failures are treated differently so a temporary
            // outage does not destroy the user's refresh token.
            if (error instanceof ApiError && error.status === 401) {
              await saveAuth(null);
              if (!cancelled) {
                setAuth(null);
                setMode('visitor');
              }
              return;
            }
          }
        }

        if (!cancelled) {
          setAuth(next);
          setMode('authenticated');
        }
      } catch (err) {
        console.warn('Failed to load session:', err);
        if (!cancelled) {
          setAuth(null);
          setMode('visitor');
        }
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (value: StoredAuth | null) => {
    setAuth(value);
    await saveAuth(value);
    setMode(value ? 'authenticated' : 'visitor');
  }, []);

  const api = useMemo(() => new ApiClient(apiUrl, () => auth), [auth]);

  const refreshCurrentSession = useCallback(async () => {
    if (!auth || !sessionNeedsRefresh(auth)) return auth;
    try {
      const refreshed = await refreshStoredSession(auth);
      await persist(refreshed);
      return refreshed;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setContext(null);
        await persist(null);
        return null;
      }
      // Keep the refresh token for transient connectivity failures and retry
      // when the app becomes active or at the next interval.
      return auth;
    }
  }, [auth, persist]);

  useEffect(() => {
    if (mode !== 'authenticated' || !auth) return;

    const tryRefresh = () => {
      if (sessionNeedsRefresh(auth)) void refreshCurrentSession();
    };

    // Covers long-running browser tabs and native sessions.
    const interval = setInterval(tryRefresh, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tryRefresh();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [mode, auth, refreshCurrentSession]);

  const login = async (identifier: string, password: string) => {
    const isEmail = identifier.includes('@');
    const res = await api.request<{
      session: {
        accessToken: string;
        refreshToken: string;
        expiresAt?: number;
        tokenType?: string;
      };
      userId: string;
    }>('login', {
      method: 'POST',
      body: JSON.stringify({
        email: isEmail ? identifier : undefined,
        phoneNumber: !isEmail ? identifier : undefined,
        password,
      }),
    });

    if (res.session) {
      await persist({
        session: {
          accessToken: res.session.accessToken,
          refreshToken: res.session.refreshToken,
          expiresAt: res.session.expiresAt,
          tokenType: res.session.tokenType || 'bearer',
        },
      });
    }
  };

  const setSession = async (session: any) => {
    if (session) {
      await persist({
        session: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          tokenType: session.tokenType || 'bearer',
        },
      });
    }
  };

  useEffect(() => {
    if (mode !== 'authenticated' || !auth) return;
    let cancelled = false;

    const loadContext = async () => {
      try {
        const value = await api.request<MembershipContext>('organization-context');
        if (cancelled) return;
        setContext(value);

        const selectedOrganizationStillAvailable = !auth.organizationId || value.organizations.some((item) => item.id === auth.organizationId) || value.creatorOrganizations?.some((item) => item.id === auth.organizationId);
        if (!selectedOrganizationStillAvailable) {
          await persist({ ...auth, organizationId: undefined, branchId: undefined });
          return;
        }

        // A disabled/removed Expression must never remain in local auth just because it
        // was selected previously. Falling back to the organization keeps General
        // Community available while respecting Platform governance.
        if (auth.branchId && !value.expression?.id) {
          await persist({ ...auth, branchId: undefined });
          return;
        }

        if (!auth.organizationId) {
          const firstOrganization = value.organizations[0] ?? value.creatorOrganizations?.[0];
          if (firstOrganization) {
            await persist({
              ...auth,
              organizationId: firstOrganization.id,
              branchId: undefined,
            });
          }
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError) {
          if (auth.branchId && ['EXPRESSION_UNAVAILABLE', 'EXPRESSION_MEMBERSHIP_REQUIRED', 'BRANCH_ACCESS_DENIED'].includes(error.code)) {
            setContext(null);
            await persist({ ...auth, branchId: undefined });
            return;
          }
          if (auth.organizationId && error.code === 'ORGANIZATION_ACCESS_DENIED') {
            setContext(null);
            await persist({ ...auth, organizationId: undefined, branchId: undefined });
            return;
          }
        }
        setContext(null);
      }
    };

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [mode, auth, api, persist]);

  const permissions = useMemo(() => context?.effectivePermissions ?? [], [context]);

  const hasCapability = useCallback(
    (code: string) => {
      if (mode !== 'authenticated') return false;
      return permissions.includes(code) || permissions.includes('*');
    },
    [mode, permissions]
  );

  const selectContext = async (organizationId: string, branchId?: string) => {
    if (auth) {
      clearContextResources();
      setContext(null);
      await persist({ ...auth, organizationId, branchId });
    }
  };

  const enterExpression = async (organizationId: string, expressionId: string) => {
    if (!auth) throw new ApiError('AUTHENTICATION_REQUIRED', 'Please sign in to continue.', 401);
    const available = context?.expressions?.some(
      (expression) => expression.organizationId === organizationId && expression.id === expressionId && expression.status === 'active',
    );
    if (!available) throw new ApiError('EXPRESSION_MEMBERSHIP_REQUIRED', 'Join this Expression before entering it.', 403);
    // Clear the old Expression-derived context before changing the request scope.
    clearContextResources();
    setContext(null);
    await persist({ ...auth, organizationId, branchId: expressionId });
  };

  const leaveExpression = async () => {
    if (!auth) return;
    clearContextResources();
    setContext(null);
    await persist({ ...auth, branchId: undefined });
  };

  const switchOrganization = async (organizationId: string) => {
    await selectContext(organizationId);
  };

  const signOut = async () => {
    clearContextResources();
    setContext(null);
    await persist(null);
  };

  return (
    <SessionContext.Provider
      value={{
        auth,
        mode,
        context,
        permissions,
        hasCapability,
        api,
        authenticate: persist,
        setSession,
        login,
        continueAsVisitor: async () => {
          clearContextResources();
          setContext(null);
          await persist(null);
        },
        enterAsVisitor: async () => {
          clearContextResources();
          setContext(null);
          await persist(null);
        },
        selectContext,
        enterExpression,
        leaveExpression,
        switchOrganization,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing');
  return value;
}
