// KR8 Digitals Supabase - Production (no Lovable dependency)
// Uses VITE_ env vars only, no hardcoded fallbacks

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const env = (import.meta as any).env || {};
  const envUrl = env['VITE_SUPABASE_URL'] as string | undefined;
  const envKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined
    || env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

  const url = (envUrl || "").trim();
  const anonKey = (envKey || "").trim();
  return { url, anonKey };
}

let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseEnv();

  if (!url || !anonKey) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      return null;
    }
  }

  return clientInstance;
}

export function isSupabaseConnected(): boolean {
  return getSupabase() !== null;
}

export function getStoredSupabaseConfig() {
  return getSupabaseEnv();
}
