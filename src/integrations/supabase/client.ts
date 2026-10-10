// KR8 Digitals Supabase Client - Secure, Auth-First
// Production project yuvslnjoutjohxgsxprb - no Lovable dependency

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function getSupabaseEnv() {
  // Client-side (Vite) - requires VITE_ prefix
  const viteUrl = (import.meta as any).env?.['VITE_SUPABASE_URL'] as string | undefined;
  const viteKey = (import.meta as any).env?.['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined
    || (import.meta as any).env?.['VITE_SUPABASE_ANON_KEY'] as string | undefined;

  // Server-side (Vercel / Nitro)
  const serverUrl = typeof process !== 'undefined' ? (process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL']) : undefined;
  const serverKey = typeof process !== 'undefined' ? (process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_ANON_KEY']) : undefined;

  const url = (viteUrl || serverUrl || "").trim();
  const key = (viteKey || serverKey || "").trim();

  return { url, key };
}

function createSupabaseClient() {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    const missing = [
      ...(!url ? ['SUPABASE_URL'] : []),
      ...(!key ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel env vars.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

// Helper to get current user with profile
export async function getCurrentUserWithProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  const { data: roles } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', session.user.id);

  return {
    user: session.user,
    session,
    profile,
    roles: roles || [],
    isAdmin: roles?.some(r => ['founder','co-founder','admin'].includes(r.role)) || false,
    isHost: roles?.some(r => ['founder','co-founder','admin','coach'].includes(r.role)) || false,
  };
}

// Helper to check if user has specific role
export async function hasRole(role: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).eq('role', role).maybeSingle();
  return !!data;
}
