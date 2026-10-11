import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Rate limiting in-memory (for serverless, use simple Map with expiry)
const rateLimitMap = new Map<string, { count: number; last: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry) {
    rateLimitMap.set(key, { count: 1, last: now });
    return true;
  }
  if (now - entry.last > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, last: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap.entries()) {
    if (now - v.last > RATE_LIMIT_WINDOW * 5) {
      rateLimitMap.delete(k);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// 1. Sign-in by KR8 ID - resolves email on server, never reveals email
// ============================================================================
const kr8SignInSchema = z.object({
  identifier: z.string().min(3).max(100), // KR8 ID or email
  password: z.string().min(1).max(100),
});

export const signInWithKr8Id = createServerFn({ method: "POST" })
  .validator((d) => kr8SignInSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Rate limit by identifier
    const rateKey = `kr8id:${data.identifier.toLowerCase()}`;
    if (!checkRateLimit(rateKey)) {
      throw new Error("Too many attempts. Please wait a minute.");
    }

    const rawId = data.identifier.trim();
    const isEmail = rawId.includes('@');
    let emailToUse: string | null = null;
    let userId: string | null = null;

    try {
      if (isEmail) {
        // Direct email - normalize
        emailToUse = rawId.toLowerCase();
        // Find user_id from profiles for logging
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id,email')
          .eq('email', emailToUse)
          .maybeSingle();
        if (profile) userId = profile.id;
      } else {
        // KR8 ID - resolve email on server only - FIX: remove .or() and ilike('%...%'), validate regex ^[A-Z0-9]{6,20}$ and exact match only
        const normalizedKr8 = rawId.toUpperCase().replace(/[\s-]/g, '');
        // Validate ID format
        if (!/^[A-Z0-9]{6,20}$/.test(normalizedKr8)) {
          throw new Error("Invalid KR8 ID or password");
        }
        const { data: profile, error } = await supabaseAdmin
          .from('profiles')
          .select('id,email,kr8_id')
          .eq('kr8_id', normalizedKr8)
          .maybeSingle();

        if (error) {
          console.warn('KR8 ID lookup error:', error.message);
          throw new Error("Invalid KR8 ID or password");
        }

        if (!profile) {
          throw new Error("Invalid KR8 ID or password");
        }
        emailToUse = profile.email;
        userId = profile.id;
      }

      if (!emailToUse) {
        throw new Error("Invalid KR8 ID or password");
      }

      // Now sign in with Supabase using email and password
      // We need to use supabaseAdmin auth? No, we need to create a session.
      // For server function, we can't directly sign in user, but we can verify password via signInWithPassword using anon client
      // Then return session tokens
      
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
      const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || process.env['VITE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Server not configured");
      }

      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

      const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: emailToUse,
        password: data.password,
      });

      if (signInError) {
        // Generic error, never reveal if email exists
        throw new Error("Invalid KR8 ID or password");
      }

      if (!signInData.session) {
        throw new Error("Invalid KR8 ID or password");
      }

      // Log activity (optional)
      try {
        await supabaseAdmin.from('activity_log').insert({
          actor_id: userId,
          action: 'sign_in',
          details: { method: 'kr8_id', identifier_type: isEmail ? 'email' : 'kr8_id' },
        });
      } catch {}

      // Return session (tokens) - client will set it
      return {
        ok: true,
        session: signInData.session,
        user: signInData.user,
      };
    } catch (err: any) {
      // Generic error for security - never reveal email
      if (err.message === "Invalid KR8 ID or password" || err.message.includes("Too many")) {
        throw err;
      }
      console.error('signInWithKr8Id error:', err);
      throw new Error("Invalid KR8 ID or password");
    }
  });

// ============================================================================
// 2. Lost password with 60-day limit
// ============================================================================
const resetRequestSchema = z.object({
  email: z.string().email(),
});

export const requestPasswordResetSecure = createServerFn({ method: "POST" })
  .validator((d) => resetRequestSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanEmail = data.email.trim().toLowerCase();

    // Rate limit
    const rateKey = `pwdreset:${cleanEmail}`;
    if (!checkRateLimit(rateKey)) {
      throw new Error("Too many reset attempts. Please wait.");
    }

    try {
      // Check password_reset_status via service_role RPC
      const { data: statusData, error: statusError } = await supabaseAdmin.rpc('password_reset_status', {
        p_email: cleanEmail,
      });

      if (statusError) {
        // If function doesn't exist yet, allow (fallback)
        console.warn('password_reset_status error (may not exist yet):', statusError.message);
      } else if (statusData && statusData.length > 0) {
        const status = statusData[0];
        if (status && !status.allowed) {
          const nextDate = status.next_allowed_at ? new Date(status.next_allowed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'in 60 days';
          throw new Error(`PASSWORD_RESET_LIMIT: Password reset can only be used once every 60 days. Next allowed: ${nextDate}`);
        }
      }

      // Log request
      try {
        await supabaseAdmin.rpc('log_password_reset', {
          p_email: cleanEmail,
        });
      } catch (e) {
        console.warn('log_password_reset failed:', e);
        // Fallback insert
        try {
          await supabaseAdmin.from('password_reset_logs').insert({
            email: cleanEmail,
            status: 'requested',
          });
        } catch {}
      }

      // Call Supabase recovery
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
      const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || process.env['VITE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
      const siteUrl = process.env['VITE_SITE_URL'] || process.env['SITE_URL'] || 'https://kr8-website-enhancer.vercel.app';

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Server not configured");
      }

      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${siteUrl}/reset-password`,
      });

      if (resetError) {
        // Check if error is due to 60-day limit from DB trigger
        if (resetError.message.includes('PASSWORD_RESET_LIMIT')) {
          throw new Error(resetError.message);
        }
        throw new Error(resetError.message);
      }

      return { ok: true, message: "Password reset email sent. Check your inbox." };
    } catch (err: any) {
      if (err.message.includes('PASSWORD_RESET_LIMIT')) {
        throw err;
      }
      console.error('requestPasswordResetSecure error:', err);
      throw new Error(err.message || "Password reset failed");
    }
  });

export const completePasswordResetSecure = createServerFn({ method: "POST" })
  .validator((d) => z.object({
    email: z.string().email(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanEmail = data.email.trim().toLowerCase();

    try {
      // Mark as completed in logs
      const { data: latest } = await supabaseAdmin
        .from('password_reset_logs')
        .select('id')
        .eq('email', cleanEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        await supabaseAdmin
          .from('password_reset_logs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', latest.id);
      }

      return { ok: true };
    } catch (err: any) {
      console.error('completePasswordResetSecure error:', err);
      // Don't block user even if logging fails
      return { ok: true };
    }
  });

// ============================================================================
// 3. Google linking - handled via Supabase client directly, but we provide helper
// ============================================================================
export const getGoogleLinkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    // Check identities via auth admin
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const hasGoogle = userData?.user?.identities?.some((i: any) => i.provider === 'google');
      return { linked: !!hasGoogle, identities: userData?.user?.identities || [] };
    } catch {
      return { linked: false, identities: [] };
    }
  });
