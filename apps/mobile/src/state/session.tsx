import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ApiClient, apiUrl, loadAuth, saveAuth, type StoredAuth } from '../api';
import type { MembershipContext } from '../types/content';

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
  continueAsVisitor: () => void;
  enterAsVisitor: () => Promise<void>;
  selectContext: (organizationId: string, branchId?: string) => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const SessionContext = createContext<Value | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [mode, setMode] = useState<Mode>('restoring');
  const [context, setContext] = useState<MembershipContext | null>(null);

  useEffect(() => {
    loadAuth()
      .then((value) => {
        setAuth(value);
        setMode(value ? 'authenticated' : 'visitor');
      })
      .catch((err) => {
        console.warn('Failed to load session:', err);
        setAuth(null);
        setMode('visitor');
      });
  }, []);

  const persist = useCallback(async (value: StoredAuth | null) => {
    setAuth(value);
    await saveAuth(value);
    setMode(value ? 'authenticated' : 'visitor');
  }, []);

  const api = useMemo(() => new ApiClient(apiUrl, () => auth), [auth]);

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
    if (mode !== 'authenticated') return;
    api
      .request<MembershipContext>('organization-context')
      .then((value) => {
        setContext(value);
        if (!auth?.organizationId && value.organizations[0]) {
          const membership = value.organizations[0].memberships?.[0];
          void persist({
            ...auth!,
            organizationId: value.organizations[0].id,
            branchId: membership?.branch_id,
          });
        }
      })
      .catch(() => setContext(null));
  }, [mode, auth?.organizationId, api, persist]);

  const permissions = useMemo(() => context?.effectivePermissions ?? [], [context]);

  const hasCapability = useCallback(
    (code: string) => {
      if (mode !== 'authenticated') return false;
      return permissions.includes(code) || permissions.includes('*');
    },
    [mode, permissions]
  );

  const selectContext = async (organizationId: string, branchId?: string) => {
    if (auth) await persist({ ...auth, organizationId, branchId });
  };

  const switchOrganization = async (organizationId: string) => {
    await selectContext(organizationId);
  };

  const signOut = async () => {
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
        continueAsVisitor: () => setMode('visitor'),
        enterAsVisitor: async () => {
          setMode('visitor');
        },
        selectContext,
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
