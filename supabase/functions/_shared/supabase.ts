import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getPublicSupabaseConfig, getServiceRoleKey } from "./config.ts";

export function userClient(token: string) {
  const config = getPublicSupabaseConfig();
  return createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function publicClient() {
  const config = getPublicSupabaseConfig();
  return createClient(config.url, config.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function adminClient() {
  const config = getPublicSupabaseConfig();
  return createClient(config.url, getServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
}
