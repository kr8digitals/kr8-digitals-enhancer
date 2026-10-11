import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OFFICIAL_WA_MAP: Record<string, string> = {
  graphic: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
  web: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
  frontend: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
  video: "https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M?s=cl&p=a&mlu=4&ilr=4",
  content_creation: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
  smm: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
  marketing: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
  tribe: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
};

const SKILL_NAMES_MAP: Record<string, string> = {
  graphic: "Graphic Design",
  web: "Website Development",
  frontend: "Front-End Development",
  video: "Video Editing & Animation",
  content_creation: "Content Creation",
  smm: "Social Media Management",
  marketing: "Digital Marketing",
  tribe: "KR8 Creative Tribe",
};

function resolveWhatsAppUrl(skillKey: string, dbUrl?: string | null): string {
  const k = (skillKey || "graphic").toLowerCase();
  const official = OFFICIAL_WA_MAP[k] || OFFICIAL_WA_MAP.graphic;
  if (!dbUrl || !dbUrl.trim() || dbUrl.includes("DgnBOEd5CfMHV8CTWgPNLH") || !dbUrl.includes("?s=cl")) {
    return official;
  }
  return dbUrl.trim();
}

const welcomeSchema = z.object({
  userId: z.string().uuid(),
  skillKey: z.string().min(1).max(50).optional(),
});

async function sendWelcomeEmailViaResend(profile: any, whatsappUrl: string, skillName: string) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] || "KR8 Digitals <noreply@kr8digitals.com>";
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping welcome email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0015;color:#fff;padding:0;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
        <div style="background:linear-gradient(135deg,#ff2e93 0%,#7c3aed 50%,#ff6b9d 100%);padding:32px 24px;text-align:center">
          <img src="https://www.kr8digitals.com/branding/kr8_logo.png" alt="KR8" style="height:52px;filter:brightness(0) invert(1)" />
          <h1 style="font-size:30px;font-weight:900;margin:18px 0 8px;color:#fff;line-height:1.1">Welcome to KR8 Digitals, ${profile.name}! 🎉</h1>
          <p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">You took the first step — 90% never do. Your tuition-free seat for <strong style="color:#fff">${skillName}</strong> is confirmed.</p>
        </div>
        <div style="padding:28px 24px">
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;margin:0 0 20px">
            <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8a7ba8;font-weight:800">Your Verifiable KR8 ID</p>
            <p style="font-family:monospace;font-size:20px;font-weight:900;color:#ff6b9d;margin:0;letter-spacing:1px">${profile.kr8_id}</p>
            <p style="font-size:12px;color:#8a7ba8;margin:8px 0 0">Keep this safe — it's your proof of craft, verified at kr8digitals.com/verify</p>
          </div>
          <div style="text-align:center;margin:24px 0">
            <p style="font-size:13px;color:#cabfe0;margin:0 0 14px;font-weight:600">Your tribe is waiting — join now to get live class links:</p>
            <a href="${whatsappUrl}" style="display:inline-block;background:#25D366;color:#fff;padding:18px 36px;border-radius:999px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 10px 30px rgba(37,211,102,0.35)">Join ${skillName} WhatsApp Group →</a>
            <p style="font-size:11px;color:#6a5b82;margin:12px 0 0">For ${skillName} — Mon/Wed/Fri 9PM-12AM WAT live, Tue/Thu/Sat assignments</p>
          </div>
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.18);border-radius:14px;padding:18px;margin:20px 0">
            <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#a7f3d0">Next steps to stay consistent:</p>
            <ol style="margin:0;padding-left:18px;font-size:13px;color:#cbd5e1;line-height:1.7">
              <li><strong style="color:#fff">Join WhatsApp group above</strong> — your tribe + class links live there</li>
              <li>Mark attendance: Mon/Wed/Fri 9PM-12AM class, Tue/Thu/Sat assignments (counts to graduation)</li>
              <li>Join live: Mindset Shift 1st & 3rd Sundays, Hangout last Sunday 7PM-11PM — auto attendance 10PM-11PM</li>
              <li>Build portfolio, climb leaderboard, graduate with QR-verified certificate + agency pipeline</li>
            </ol>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;margin-top:20px">
            <p style="font-size:12px;color:#8a7ba8;margin:0"><strong style="color:#fff">100% Tuition-Free Promise:</strong> No hidden fees. We invest in your craft; you invest consistency. Show up daily, we show you the industry.</p>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.03);padding:14px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="font-size:11px;color:#6a5b82;margin:0">You received this because you registered at kr8digitals.com • KR8 Digitals — Creative Excellence<br/>If you didn't register, ignore this email.</p>
        </div>
      </div>
    `;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: profile.email,
        subject: `Welcome to KR8 ${skillName} — Your KR8 ID ${profile.kr8_id} + WhatsApp Group`,
        html,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || `Resend error ${res.status}`);
    return { ok: true, resendId: result.id };
  } catch (err: any) {
    console.error("Welcome email failed:", err);
    return { ok: false, error: err.message };
  }
}

const regConfirmEmailSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  skillKey: z.string().optional(),
  mode: z.enum(["student", "tribe"]).optional(),
  siteOrigin: z.string().optional(),
});

export const sendRegistrationConfirmationEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => regConfirmEmailSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM"] || "KR8 Digitals <noreply@kr8digitals.com>";
    const siteUrl = data.siteOrigin || process.env["VITE_SITE_URL"] || "https://www.kr8digitals.com";
    const skillKey = data.skillKey || (data.mode === "tribe" ? "tribe" : "graphic");
    const skillName = SKILL_NAMES_MAP[skillKey] || skillKey;

    let confirmUrl = `${siteUrl}/auth/confirmed?email=${encodeURIComponent(data.email)}&skill=${encodeURIComponent(skillKey)}&name=${encodeURIComponent(data.name)}`;

    // Try to generate an official Supabase confirmation action_link via supabaseAdmin so clicking the button confirms in Supabase Auth too
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
        options: {
          redirectTo: confirmUrl,
        },
      });
      if (linkData?.properties?.action_link) {
        confirmUrl = linkData.properties.action_link;
      }
    } catch {}

    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY not configured", confirmUrl };
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Confirm Your KR8 Digitals Registration</title>
      </head>
      <body style="margin:0;padding:20px;background:#08000f;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#ffffff;">
        <div style="max-width:620px;margin:0 auto;background:linear-gradient(160deg,#1b0630 0%,#0d0018 100%);border-radius:28px;overflow:hidden;border:1px solid rgba(255,46,147,0.35);box-shadow:0 24px 60px rgba(0,0,0,0.6);">
          <div style="background:linear-gradient(135deg,#ff2e93 0%,#7c3aed 55%,#ff6b9d 100%);padding:40px 28px;text-align:center;">
            <img src="https://www.kr8digitals.com/branding/kr8_logo.png" alt="KR8 Digitals" style="height:54px;filter:brightness(0) invert(1);" />
            <div style="display:inline-block;margin-top:14px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.25);border-radius:999px;padding:6px 16px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#fff;">
              Step 1 Complete · Action Required
            </div>
            <h1 style="font-size:30px;font-weight:900;margin:16px 0 8px;color:#ffffff;line-height:1.15;">
              You Took the First Step, ${data.name}! 🎉
            </h1>
            <p style="font-size:15px;color:rgba(255,255,255,0.92);margin:0;line-height:1.5;">
              Welcome to the KR8 family! Confirm your email below to officially activate your account and unlock your WhatsApp Learning Group.
            </p>
          </div>

          <div style="padding:32px 28px;">
            <div style="background:rgba(255,46,147,0.1);border:2px solid rgba(255,46,147,0.45);border-radius:20px;padding:24px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:#ff6b9d;">
                ⚡ Important Final Step
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#f3e8ff;line-height:1.55;">
                Click the large button below to <strong>confirm your email address</strong>, generate your official verifiable <strong>KR8 ID</strong>, and get instant access to your <strong>${skillName} WhatsApp Learning Group</strong>:
              </p>
              <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff2e93 0%,#9333ea 100%);color:#ffffff;padding:20px 42px;border-radius:999px;text-decoration:none;font-weight:900;font-size:17px;letter-spacing:0.3px;box-shadow:0 14px 35px rgba(255,46,147,0.45);">
                ✓ CONFIRM MY EMAIL & COMPLETE REGISTRATION →
              </a>
            </div>

            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 14px;font-size:16px;font-weight:800;color:#ffffff;">
                🌟 What You Signed Up For at KR8 Digitals:
              </h3>
              <ul style="margin:0;padding-left:20px;font-size:14px;color:#d8ccf0;line-height:1.75;">
                <li><strong style="color:#ffffff;">Track Selected:</strong> ${skillName} (${data.mode === "tribe" ? "Lifetime Community Access" : "8-Week Intensive Practical Cohort"})</li>
                <li><strong style="color:#ffffff;">100% Tuition-Free Promise:</strong> ₦0 for classes, ₦0 for mentorship, ₦0 for graduation & QR-verified certification.</li>
                <li><strong style="color:#ffffff;">Live Practical Classes:</strong> Mondays, Wednesdays & Fridays (9:00 PM – 12:00 AM WAT) with senior industry practitioners.</li>
                <li><strong style="color:#ffffff;">Hands-On Drills & Feedback:</strong> Tuesdays, Thursdays & Saturdays — build real client-grade projects and earn XP on the Leaderboard.</li>
                <li><strong style="color:#ffffff;">Mindset Shift & Tribe Hangouts:</strong> 1st & 3rd Sundays (Mindset Shift) + Last Sunday of the Month (All-Tribe Hangout).</li>
                <li><strong style="color:#ffffff;">Verifiable KR8 ID & Certificate:</strong> Graduate with a Certificate of Professionalism (Excellence) or Completion verifiable worldwide at <em>kr8digitals.com/verify</em>.</li>
              </ul>
            </div>

            <p style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;margin:0;">
              If the button above doesn't open automatically, copy and paste this link into your browser:<br />
              <a href="${confirmUrl}" style="color:#ff6b9d;word-break:break-all;">${confirmUrl}</a>
            </p>
          </div>

          <div style="background:rgba(0,0,0,0.35);padding:18px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="font-size:12px;color:#8a7ba8;margin:0;">
              KR8 Digitals — Learn Free. Belong Deeply. Build for Real.<br />
              Need help? Contact us at kr8digitals01@gmail.com
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: data.email,
          subject: `🎉 Action Required: Confirm Your Email to Complete Your KR8 ${skillName} Registration!`,
          html,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || `Resend error ${res.status}`);
      return { ok: true, resendId: result.id, confirmUrl };
    } catch (err: any) {
      console.warn("Registration confirmation email via Resend failed:", err.message);
      return { ok: false, error: err.message, confirmUrl };
    }
  });

export const sendWelcomeWithWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => welcomeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, skillKey } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callerId = (context as any).userId;

    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = callerRoles?.some((r: any) => ["founder", "co-founder", "admin"].includes(r.role));
    if (callerId !== userId && !isAdmin) throw new Error("Unauthorized");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,kr8_id,name,email,skill")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const effectiveSkill = skillKey || profile.skill || "graphic";
    const { data: skillSetting } = await supabaseAdmin
      .from("skill_settings")
      .select("skill_key,name,whatsapp_url")
      .eq("skill_key", effectiveSkill)
      .maybeSingle();

    const whatsappUrl = resolveWhatsAppUrl(effectiveSkill, skillSetting?.whatsapp_url);
    const skillName = skillSetting?.name || SKILL_NAMES_MAP[effectiveSkill] || effectiveSkill;

    const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      text: `Welcome to KR8 ${skillName}! Your KR8 ID ${profile.kr8_id} is ready. Join your WhatsApp learning group: ${whatsappUrl}`,
      read: false,
      link: whatsappUrl,
    });
    if (notificationError) console.warn("notification insert failed", notificationError.message);

    const emailResult = await sendWelcomeEmailViaResend(profile, whatsappUrl, skillName);

    try {
      await supabaseAdmin.from("activity_log").insert({
        actor_id: callerId,
        action: "welcome_sent",
        target: profile.kr8_id,
        details: { skill: effectiveSkill, whatsappUrl, emailOk: emailResult.ok },
      });
    } catch {}

    return { ok: true, whatsappUrl, skillName, emailOk: emailResult.ok, emailError: (emailResult as any).error };
  });

export const bulkWelcomeToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callerId = (context as any).userId;
    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = callerRoles?.some((r: any) => ["founder", "co-founder", "admin"].includes(r.role));
    if (!isAdmin) throw new Error("Only admin/founder can bulk welcome");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: todays } = await supabaseAdmin
      .from("profiles")
      .select("id,kr8_id,name,email,skill,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!todays || todays.length === 0) return { ok: true, count: 0, message: "No registrations in last 24h" };

    let sent = 0;
    let failed = 0;
    const details: any[] = [];
    for (const p of todays) {
      try {
        const skillKey = p.skill || "graphic";
        const { data: skillSetting } = await supabaseAdmin
          .from("skill_settings")
          .select("name,whatsapp_url")
          .eq("skill_key", skillKey)
          .maybeSingle();
        const whatsappUrl = resolveWhatsAppUrl(skillKey, skillSetting?.whatsapp_url);
        const skillName = skillSetting?.name || SKILL_NAMES_MAP[skillKey] || skillKey;

        const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
          user_id: p.id,
          text: `Welcome to KR8 ${skillName}! Your KR8 ID ${p.kr8_id} is ready. Join your WhatsApp group: ${whatsappUrl}`,
          read: false,
          link: whatsappUrl,
        });
        if (notificationError) console.warn("notification insert failed", notificationError.message);

        const emailResult = await sendWelcomeEmailViaResend(p, whatsappUrl, skillName);
        details.push({ email: p.email, kr8_id: p.kr8_id, skill: skillKey, ok: emailResult.ok, whatsappUrl });
        sent++;
      } catch (e) {
        console.warn("bulk welcome failed for", p.id, e);
        failed++;
      }
    }

    return { ok: true, count: sent, failed, total: todays.length, details };
  });
