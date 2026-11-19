import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getPublicSupabaseConfig, getServiceRoleKey } from "./config.ts";

// Supabase has been returning intermittent PGRST303 responses when the API
// gateway's short-lived JWT is rejected by PostgREST. Retry only this specific
// authentication-validation error; all other 401 responses retain their normal
// behavior and are never retried.
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
  return createClient(config.url, getServiceRoleKey(), {
    global: { fetch: fetchWithPostgrestAuthRetry },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
