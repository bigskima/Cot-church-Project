import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getPublicSupabaseConfig, getServiceRoleKey } from "./config.ts";

// PostgREST 14.x can intermittently reject gateway-minted JWTs with PGRST303.
// Retry only that error; do not retry ordinary authentication or permission failures.
const POSTGREST_AUTH_RETRY_DELAYS_MS = [150, 450, 1000];

async function fetchWithPostgrestAuthRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const replayableBody = init?.body == null || typeof init.body === "string";
  const run = () => fetch(input instanceof Request ? input.clone() : input, init);
  let response = await run();

  if (!replayableBody) return response;

  for (const delayMs of POSTGREST_AUTH_RETRY_DELAYS_MS) {
    if (response.status !== 401) break;
    const payload = await response.clone().json().catch(() => null);
    if (payload?.code !== "PGRST303") break;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    response = await run();
  }

  return response;
}

// Opaque Supabase secret keys are API keys, not JWTs. supabase-js normally
// mirrors its constructor key into Authorization: Bearer. Supabase's hosted
// gateway expects the secret key only in apikey and mints the service-role
// credential for the upstream Data API itself.
function createSecretKeyFetch(secretKey: string) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.set("apikey", secretKey);
    headers.delete("Authorization");
    return fetchWithPostgrestAuthRetry(new Request(request, { headers }));
  };
}

export function userClient(token: string) {
  const config = getPublicSupabaseConfig();
  return createClient(config.url, config.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: fetchWithPostgrestAuthRetry,
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function publicClient() {
  const config = getPublicSupabaseConfig();
  return createClient(config.url, config.anonKey, {
    global: { fetch: fetchWithPostgrestAuthRetry },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function adminClient() {
  const config = getPublicSupabaseConfig();
  const secretKey = getServiceRoleKey();
  return createClient(config.url, secretKey, {
    global: { fetch: createSecretKeyFetch(secretKey) },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
