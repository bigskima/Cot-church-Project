import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ApiClient, apiUrl, loadAuth, saveAuth, type StoredAuth } from '../api';
import type { MembershipContext } from '../types/content';

type Mode = 'restoring' | 'visitor' | 'authenticated';
type Value = {
  auth: StoredAuth | null;
  mode: Mode;
  context: MembershipContext | null;
  api: ApiClient;
  authenticate: (value: StoredAuth) => Promise<void>;
  continueAsVisitor: () => void;
  selectContext: (organizationId: string, branchId?: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const SessionContext = createContext<Value | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [mode, setMode] = useState<Mode>('restoring');
  const [context, setContext] = useState<MembershipContext | null>(null);
  useEffect(() => { loadAuth().then(value => { setAuth(value); setMode(value ? 'authenticated' : 'visitor'); }); }, []);
  const persist = useCallback(async (value: StoredAuth | null) => {
    setAuth(value); await saveAuth(value); setMode(value ? 'authenticated' : 'visitor');
  }, []);
  const api = useMemo(() => new ApiClient(apiUrl, () => auth), [auth]);
  useEffect(() => {
    if (mode !== 'authenticated') return;
    api.request<MembershipContext>('organization-context').then(value => {
      setContext(value);
      if (!auth?.organizationId && value.organizations[0]) {
        const membership = value.organizations[0].memberships[0];
        void persist({ ...auth!, organizationId: value.organizations[0].id, branchId: membership?.branch_id });
      }
    }).catch(() => setContext(null));
  }, [mode, auth?.organizationId, api, persist]);
  const selectContext = async (organizationId: string, branchId?: string) => {
    if (auth) await persist({ ...auth, organizationId, branchId });
  };
  const signOut = async () => { setContext(null); await persist(null); };
  return <SessionContext.Provider value={{ auth, mode, context, api, authenticate: persist, continueAsVisitor: () => setMode('visitor'), selectContext, signOut }}>{children}</SessionContext.Provider>;
}
export function useSession() { const value = useContext(SessionContext); if (!value) throw new Error('SessionProvider is missing'); return value; }
