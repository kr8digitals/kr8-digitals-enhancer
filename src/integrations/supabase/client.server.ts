// Secure server-side Supabase client
// Uses SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY when available,
// and includes a fast network timeout so server routes never hang if outbound access is restricted.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_SUPABASE_URL = 'https://yuvslnjoutjohxgsxprb.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable_q60a1XstG2ybfB3b0_811A_h1269H87';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      return await fetch(input, {
        ...init,
        headers,
        signal: init?.signal || controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

function getAdminEnv() {
  const url =
    process.env['SUPABASE_URL'] ||
    process.env['VITE_SUPABASE_URL'] ||
    FALLBACK_SUPABASE_URL;

  const serviceKey =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
    process.env['SUPABASE_SECRET_KEY'] ||
    process.env['SUPABASE_SERVICE_KEY'] ||
    process.env['SUPABASE_PUBLISHABLE_KEY'] ||
    process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    process.env['VITE_SUPABASE_ANON_KEY'] ||
    FALLBACK_SUPABASE_KEY;

  return { url, serviceKey };
}

function createSupabaseAdminClient() {
  const { url, serviceKey } = getAdminEnv();

  return createClient<Database>(url, serviceKey, {
    global: {
      fetch: createSupabaseFetch(serviceKey),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});

export async function getAuthenticatedUser(token?: string) {
  if (!token) return null;

  const { url } = getAdminEnv();
  const anonKey =
    process.env['SUPABASE_PUBLISHABLE_KEY'] ||
    process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    process.env['VITE_SUPABASE_ANON_KEY'] ||
    FALLBACK_SUPABASE_KEY;

  const client = createClient<Database>(url, anonKey, {
    global: {
      fetch: createSupabaseFetch(anonKey),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return null;

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role, permissions, title')
      .eq('user_id', user.id);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return {
      user,
      profile,
      roles: roles || [],
      isFounder: roles?.some((r: any) => r.role === 'founder') || false,
      isAdmin: roles?.some((r: any) => ['founder', 'co-founder', 'admin'].includes(r.role)) || false,
      isStaff: roles?.some((r: any) => ['founder', 'co-founder', 'admin', 'moderator', 'coach', 'attendance_reviewer'].includes(r.role)) || false,
    };
  } catch {
    return null;
  }
}
