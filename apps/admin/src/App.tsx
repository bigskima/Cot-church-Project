import { useMemo, useState } from 'react';
import { ApiClient, loadAuth, saveAuth, type AuthState } from './api';
import { Login } from './components/Login';
import { Shell } from './components/Shell';

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());

  function update(value: AuthState | null) {
    saveAuth(value);
    setAuth(value);
  }

  const api = useMemo(() => new ApiClient(() => auth, update), [auth]);

  return auth
    ? <Shell api={api} auth={auth} updateAuth={update} />
    : <Login api={api} onAuthenticated={update} />;
}
