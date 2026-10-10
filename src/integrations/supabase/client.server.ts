// Secure server-side Supabase client with service role key
// For new project yuvslnjoutjohxgsxprb with full control of keys
// Use only in server functions and server routes - never expose to client

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

function getAdminEnv() {
  // Support both new env naming and legacy
  const url = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
  // Service role key may be stored as SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY (new Supabase naming)
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SECRET_KEY'] || process.env['SUPABASE_SERVICE_KEY'];

  return { url, serviceKey };
}

function createSupabaseAdminClient() {
  const { url, serviceKey } = getAdminEnv();

  if (!url || !serviceKey) {
    const missing = [
      ...(!url ? ['SUPABASE_URL'] : []),
      ...(!serviceKey ? ['SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Set them in Vercel env vars. For new project yuvslnjoutjohxgsxprb, get keys from Supabase Dashboard > Project Settings > API.`;
    console.error(`[Supabase Admin] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(url, serviceKey, {
    global: {
      fetch: createSupabaseFetch(serviceKey),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});

// Helper to get authenticated user from request context (for server functions)
export async function getAuthenticatedUser(token?: string) {
  if (!token) return null;

  const { url, serviceKey } = getAdminEnv();
  // Use anon client to verify token
  const anonKey = process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !anonKey) return null;

  const client = createClient<Database>(url, anonKey, {
    global: {
      fetch: createSupabaseFetch(anonKey),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return {
    id: data.claims.sub,
    claims: data.claims,
  };
}

// Check if user is admin/host via DB
export async function checkUserRole(userId: string, allowedRoles: string[]): Promise<boolean> {
  try {
    const admin = supabaseAdmin;
    const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).in('role', allowedRoles);
    return !!data && data.length > 0;
  } catch {
    return false;
  }
}

export async function isUserHost(userId: string): Promise<boolean> {
  return checkUserRole(userId, ['founder', 'co-founder', 'admin', 'coach']);
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  return checkUserRole(userId, ['founder', 'co-founder', 'admin']);
}
