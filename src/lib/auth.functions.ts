import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function normalizePhoneDigits(phone: string): string {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 11) {
    return "234" + digits.slice(1);
  }
  return digits;
}

const FOUNDER_EMAILS_SET = new Set(["kr8digitals01@gmail.com", "kutimfire001@gmail.com"]);
const FOUNDER_PHONES_SET = new Set(["2348125687509", "2348166552758", "08125687509", "08166552758"]);
const COFOUNDER_PHONES_SET = new Set(["2348089344434", "2348106068523", "08089344434", "08106068523"]);
const MAIN_ADMIN_PASSWORD = "KR8@Adm!n2026";

async function ensureExecutiveRoleInDb(supabaseAdmin: any, userId: string, role: "founder" | "co-founder") {
  const allPerms = [
    "all",
    "view_students",
    "issue_certificates",
    "review_attendance",
    "manage_content",
    "manage_live",
    "moderation",
    "manage_links",
    "view_finance",
    "manage_roles",
  ];
  try {
    await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: userId,
        role,
        title: role === "founder" ? "Founder & CEO" : "Co-Founder",
        permissions: allPerms,
      } as any,
      { onConflict: "user_id,role" }
    );
  } catch {}
}

// 1. Sign-in with Email, KR8 ID, or Phone Number
const kr8SignInSchema = z.object({
  identifier: z.string().min(3).max(120),
  password: z.string().min(6).max(200),
});

export const signInWithKr8Id = createServerFn({ method: "POST" })
  .inputValidator((d) => kr8SignInSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const rawId = data.identifier.trim();
    const isEmail = rawId.includes("@");
    const phoneDigits = normalizePhoneDigits(rawId);
    const isPhone = !isEmail && phoneDigits.length >= 9 && /^[+0-9\s()-]+$/.test(rawId);
    const upperId = rawId.toUpperCase();
    const cleanAlphaNum = upperId.replace(/[^A-Z0-9]/g, "");

    const isFounderIdentifier =
      (isEmail && FOUNDER_EMAILS_SET.has(rawId.toLowerCase())) ||
      (isPhone && FOUNDER_PHONES_SET.has(phoneDigits)) ||
      upperId === "KR8-FOUNDER-TIMFIRE" ||
      cleanAlphaNum === "KR8FOUNDERTIMFIRE";

    const isCoFounderIdentifier =
      (isPhone && COFOUNDER_PHONES_SET.has(phoneDigits)) ||
      upperId === "KR8-COFOUNDER-STEVENSON" ||
      upperId === "KR8-COFOUNDER-DANIEL" ||
      cleanAlphaNum === "KR8COFOUNDERSTEVENSON" ||
      cleanAlphaNum === "KR8COFOUNDERDANIEL";

    let emailToUse = isEmail ? rawId.toLowerCase() : "";
    let matchedProfile: any = null;

    // Resolve non-email identifier (KR8 ID or Phone) from profiles
    if (!isEmail) {
      if (isPhone) {
        const { data: byPhone } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .or(`phone_normalized.eq.${phoneDigits},phone.ilike.%${phoneDigits.slice(-10)}%`)
          .limit(1)
          .maybeSingle();
        if (byPhone?.email) {
          matchedProfile = byPhone;
          emailToUse = byPhone.email.toLowerCase();
        }
      }

      if (!emailToUse) {
        // Lookup by exact KR8 ID or stripped KR8 ID
        const { data: byKr8 } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .or(`kr8_id.ilike.${rawId},kr8_id.ilike.${cleanAlphaNum}`)
          .limit(1)
          .maybeSingle();
        if (byKr8?.email) {
          matchedProfile = byKr8;
          emailToUse = byKr8.email.toLowerCase();
        }
      }

      // If Founder used KR8-FOUNDER-TIMFIRE or Founder Phone and wasn't matched by phone/kr8_id yet, find founder profile by email
      if (!emailToUse && isFounderIdentifier) {
        const { data: founderProf } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .or("email.ilike.kr8digitals01@gmail.com,email.ilike.kutimfire001@gmail.com")
          .limit(1)
          .maybeSingle();
        if (founderProf?.email) {
          matchedProfile = founderProf;
          emailToUse = founderProf.email.toLowerCase();
        } else {
          emailToUse = "kr8digitals01@gmail.com";
        }
      }
    } else {
      const { data: byEmail } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .ilike("email", emailToUse)
        .limit(1)
        .maybeSingle();
      if (byEmail) matchedProfile = byEmail;
    }

    if (!emailToUse) {
      return { ok: false, error: "Account not found. Please check your Email, KR8 ID, or Phone Number." };
    }

    const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]!;
    const supabaseAnonKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["VITE_SUPABASE_ANON_KEY"]!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: createSupabaseFetch(supabaseAnonKey) },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isFounderUser =
      isFounderIdentifier ||
      FOUNDER_EMAILS_SET.has(emailToUse) ||
      (matchedProfile?.phone_normalized && FOUNDER_PHONES_SET.has(matchedProfile.phone_normalized));

    const isCoFounderUser =
      !isFounderUser &&
      (isCoFounderIdentifier ||
        (matchedProfile?.phone_normalized && COFOUNDER_PHONES_SET.has(matchedProfile.phone_normalized)));

    // If Founder or Co-Founder has a profile in DB, make sure their email is confirmed and user_roles is set
    if ((isFounderUser || isCoFounderUser) && matchedProfile?.id) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(matchedProfile.id, {
          email_confirm: true,
        });
      } catch {}
      await ensureExecutiveRoleInDb(supabaseAdmin, matchedProfile.id, isFounderUser ? "founder" : "co-founder");
    }

    let { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email: emailToUse,
      password: data.password,
    });

    // If Founder or Co-Founder is signing in with MAIN_ADMIN_PASSWORD or their account wasn't provisioned in auth.users yet
    if (authErr && (isFounderUser || isCoFounderUser)) {
      if (matchedProfile?.id && data.password === MAIN_ADMIN_PASSWORD) {
        // Allow Founder/Co-Founder emergency unlock with MAIN_ADMIN_PASSWORD
        try {
          await supabaseAdmin.auth.admin.updateUserById(matchedProfile.id, {
            password: data.password,
            email_confirm: true,
          });
          const retry = await authClient.auth.signInWithPassword({
            email: emailToUse,
            password: data.password,
          });
          authData = retry.data;
          authErr = retry.error;
        } catch {}
      } else if (!matchedProfile?.id && isFounderUser) {
        // Provision Founder account in Supabase Auth if not created yet
        try {
          const { data: created } = await supabaseAdmin.auth.admin.createUser({
            email: emailToUse,
            password: data.password,
            email_confirm: true,
            user_metadata: {
              name: "Kenneth Timothy Iziogo (Timfire)",
              phone: "+2348125687509",
              country: "NG",
              skill: "web",
            },
          });
          if (created?.user?.id) {
            await ensureExecutiveRoleInDb(supabaseAdmin, created.user.id, "founder");
            const retry = await authClient.auth.signInWithPassword({
              email: emailToUse,
              password: data.password,
            });
            authData = retry.data;
            authErr = retry.error;
          }
        } catch {}
      }
    }

    if (authErr || !authData?.session) {
      const msg = authErr?.message || "";
      if (msg.toLowerCase().includes("email not confirmed")) {
        return {
          ok: false,
          code: "EMAIL_NOT_CONFIRMED",
          email: emailToUse,
          error:
            "Your email address is not confirmed yet! Please open your email inbox (or Spam/Promotions folder) and click the confirmation button we sent you, or click 'Resend Confirmation Email' below.",
        };
      }
      return {
        ok: false,
        error: "Invalid credentials. Please check your Email / KR8 ID / Phone and password.",
      };
    }

    // Ensure Founder / Co-Founder role is persisted in user_roles upon successful login
    if (authData.user?.id && (isFounderUser || isCoFounderUser)) {
      await ensureExecutiveRoleInDb(supabaseAdmin, authData.user.id, isFounderUser ? "founder" : "co-founder");
    }

    // Log login activity
    try {
      await supabaseAdmin.from("activity_log").insert({
        actor_id: authData.user.id,
        action: "user_signin",
        target: matchedProfile?.kr8_id || emailToUse,
        details: { method: isEmail ? "email" : isPhone ? "phone" : "kr8_id" },
      });
    } catch {}

    return {
      ok: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        user: authData.user,
      },
    };
  });

const syncRoleSchema = z.object({
  userId: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const syncExecutiveUserRoles = createServerFn({ method: "POST" })
  .inputValidator((d) => syncRoleSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailLower = (data.email || "").trim().toLowerCase();
    const phoneDigits = normalizePhoneDigits(data.phone || "");

    const isFounder =
      FOUNDER_EMAILS_SET.has(emailLower) || FOUNDER_PHONES_SET.has(phoneDigits);
    const isCoFounder = !isFounder && COFOUNDER_PHONES_SET.has(phoneDigits);

    if (isFounder) {
      await ensureExecutiveRoleInDb(supabaseAdmin, data.userId, "founder");
    } else if (isCoFounder) {
      await ensureExecutiveRoleInDb(supabaseAdmin, data.userId, "co-founder");
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, permissions")
      .eq("user_id", data.userId);

    return { ok: true, roles: roles || [], isFounder, isCoFounder };
  });

// 2. Password reset request with 30-day limit enforced server-side
const resetReqSchema = z.object({
  email: z.string().email(),
});

export const requestPasswordResetSecure = createServerFn({ method: "POST" })
  .inputValidator((d) => resetReqSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const email = data.email.trim().toLowerCase();

    const { data: check, error: checkErr } = await supabaseAdmin.rpc("request_password_reset_check", {
      p_email: email,
    });

    if (checkErr) {
      throw new Error(checkErr.message);
    }

    const result = check as any;
    if (result && result.allowed === false) {
      return {
        ok: false,
        rateLimited: true,
        daysRemaining: result.days_remaining || 30,
        message:
          result.reason ||
          `You can only reset your password once every 30 days. Try again in ${result.days_remaining || 30} days or contact an admin for an exception.`,
      };
    }

    const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]!;
    const supabaseAnonKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["VITE_SUPABASE_ANON_KEY"]!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: createSupabaseFetch(supabaseAnonKey) },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const siteUrl = process.env["VITE_SITE_URL"] || "https://kr8digitals.com";
    await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    return {
      ok: true,
      message:
        "If an account exists for that email, a password reset link has been sent. Please check your inbox.",
    };
  });

// 3. Complete password reset and record timestamp
const completeResetSchema = z.object({
  userId: z.string().uuid(),
});

export const completePasswordResetSecure = createServerFn({ method: "POST" })
  .inputValidator((d) => completeResetSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("complete_password_reset", {
      p_user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 4. Google OAuth linking verification
const linkGoogleSchema = z.object({
  userId: z.string().uuid(),
});

export const getGoogleLinkStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => linkGoogleSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error || !userData?.user) return { linked: false, googleEmail: null };

    const googleIdentity = userData.user.identities?.find((i: any) => i.provider === "google");
    return {
      linked: !!googleIdentity,
      googleEmail: googleIdentity?.identity_data?.email || null,
    };
  });
