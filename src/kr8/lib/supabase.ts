// @ts-nocheck
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// KR8 Digitals database (Lovable Cloud)
const DEFAULT_SUPABASE_URL = "https://zvdkzldiabedjsxhwvbm.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_tjWargPs1GiV1boWO1dtRg_7T8Curil";

const getSupabaseEnv = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (typeof window !== "undefined") {
    try {
      // Old saved overrides pointed at the retired database
      localStorage.removeItem("kr8_supabase_url");
      localStorage.removeItem("kr8_supabase_anon_key");
    } catch {
      /* ignore */
    }
  }
  const url = (envUrl || DEFAULT_SUPABASE_URL).trim();
  const anonKey = (envKey || DEFAULT_SUPABASE_ANON_KEY).trim();
  return { url, anonKey };
};

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

export function saveSupabaseConfig(url: string, anonKey: string): boolean {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("kr8_supabase_url", url.trim());
      localStorage.setItem("kr8_supabase_anon_key", anonKey.trim());
      clientInstance = null; // reset client instance to reload with new keys
      window.dispatchEvent(new Event("kr8:supabase-configured"));
    }
    return true;
  } catch {
    return false;
  }
}

export function getStoredSupabaseConfig() {
  return getSupabaseEnv();
}
