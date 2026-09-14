import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { apiUrl } from '@/api';

type RuntimeConfig = { url: string; anonKey: string };

let configPromise: Promise<RuntimeConfig> | null = null;
const clients = new Map<string, SupabaseClient>();

async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!apiUrl) throw new Error('COT API is not configured.');
  if (!configPromise) {
    configPromise = fetch(`${apiUrl}/realtime-config`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load the database runtime configuration.');
        const payload = await response.json() as { data?: RuntimeConfig };
        if (!payload.data?.url || !payload.data?.anonKey) throw new Error('Database runtime configuration is incomplete.');
        return payload.data;
      })
      .catch((error) => {
        configPromise = null;
        throw error;
      });
  }
  return configPromise;
}

export async function getRuntimeSupabase(accessToken?: string | null) {
  const config = await getRuntimeConfig();
  const token = accessToken || 'visitor';
  const cached = clients.get(token);
  if (cached) return cached;

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
  clients.set(token, client);
  return client;
}

export async function runRuntimeRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  accessToken?: string | null,
): Promise<T> {
  const client = await getRuntimeSupabase(accessToken);
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message || `Unable to run ${fn}.`);
  return data as T;
}
