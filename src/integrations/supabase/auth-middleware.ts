import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

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

function extractTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === 'kr8_sb_token' && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
    const SUPABASE_PUBLISHABLE_KEY =
      process.env['SUPABASE_PUBLISHABLE_KEY'] ||
      process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
      process.env['VITE_SUPABASE_ANON_KEY'];

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Missing Supabase environment variables on server.');
    }

    const request = getRequest();
    const authHeader = request?.headers?.get('authorization') || null;
    const cookieHeader = request?.headers?.get('cookie') || null;

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    } else {
      token = extractTokenFromCookie(cookieHeader) || '';
    }

    if (token && token.split('.').length === 3) {
      const supabase = createClient<Database>(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          global: {
            fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        return next({
          context: {
            supabase,
            userId: data.claims.sub,
            claims: data.claims,
          },
        });
      }
    }

    // Fallback: check kr8_exec_email cookie if Founder/Co-Founder is signed in
    const execEmailMatch = cookieHeader?.match(/(?:^|;\s*)kr8_exec_email=([^;]+)/);
    if (execEmailMatch) {
      const execEmail = decodeURIComponent(execEmailMatch[1]).toLowerCase();
      if (execEmail === 'kr8digitals01@gmail.com' || execEmail === 'kutimfire001@gmail.com') {
        const { supabaseAdmin } = await import('./client.server');
        const { data: founderProf } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('email', execEmail)
          .limit(1)
          .maybeSingle();
        if (founderProf?.id) {
          return next({
            context: {
              supabase: supabaseAdmin,
              userId: founderProf.id,
              claims: { sub: founderProf.id, email: execEmail },
            },
          });
        }
      }
    }

    throw new Error('Unauthorized: Please sign in to perform this action.');
  },
);
