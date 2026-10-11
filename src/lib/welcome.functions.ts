import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
            <a href="${whatsappUrl}" style="display:inline-block;background:#25D366;color:#fff;padding:16px 32px;border-radius:999px;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 10px 30px rgba(37,211,102,0.35)">Join ${skillName} WhatsApp Group →</a>
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

export const sendWelcomeWithWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => welcomeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, skillKey } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callerId = (context as any).userId;

    const { data: callerRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', callerId);
    const isAdmin = callerRoles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (callerId !== userId && !isAdmin) throw new Error("Unauthorized");

    const { data: profile } = await supabaseAdmin.from('profiles').select('id,kr8_id,name,email,skill').eq('id', userId).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const effectiveSkill = skillKey || profile.skill || 'graphic';
    const fallbackMap: Record<string,string> = {
      graphic: 'https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU',
      web: 'https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v',
      video: 'https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M',
    };
    const { data: skillSetting } = await supabaseAdmin.from('skill_settings').select('skill_key,name,whatsapp_url').eq('skill_key', effectiveSkill).maybeSingle();
    const whatsappUrl = skillSetting?.whatsapp_url || fallbackMap[effectiveSkill] || 'https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU';
    const skillName = skillSetting?.name || effectiveSkill;

    const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      text: `Welcome to KR8 ${skillName}! Your KR8 ID ${profile.kr8_id} is ready. Join your WhatsApp learning group: ${whatsappUrl}`,
      read: false,
      link: whatsappUrl,
    });
    if (notificationError) console.warn('notification insert failed', notificationError.message);

    const emailResult = await sendWelcomeEmailViaResend(profile, whatsappUrl, skillName);

    try {
      await supabaseAdmin.from('activity_log').insert({
        actor_id: callerId,
        action: 'welcome_sent',
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
    const { data: callerRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', callerId);
    const isAdmin = callerRoles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isAdmin) throw new Error("Only admin/founder can bulk welcome");

    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: todays } = await supabaseAdmin.from('profiles').select('id,kr8_id,name,email,skill,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(100);
    if (!todays || todays.length === 0) return { ok: true, count: 0, message: "No registrations in last 24h" };

    const fallbackMap: Record<string,string> = {
      graphic: 'https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU',
      web: 'https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v',
      video: 'https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M',
    };

    let sent = 0;
    let failed = 0;
    const details: any[] = [];
    for (const p of todays) {
      try {
        const skillKey = p.skill || 'graphic';
        const { data: skillSetting } = await supabaseAdmin.from('skill_settings').select('name,whatsapp_url').eq('skill_key', skillKey).maybeSingle();
        const whatsappUrl = skillSetting?.whatsapp_url || fallbackMap[skillKey] || fallbackMap["graphic"]!;
        const skillName = skillSetting?.name || skillKey;

        const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
          user_id: p.id,
          text: `Welcome to KR8 ${skillName}! Your KR8 ID ${p.kr8_id} is ready. Join your WhatsApp group: ${whatsappUrl}`,
          read: false,
          link: whatsappUrl,
        });
        if (notificationError) console.warn('notification insert failed', notificationError.message);

        const emailResult = await sendWelcomeEmailViaResend(p, whatsappUrl, skillName);
        details.push({ email: p.email, kr8_id: p.kr8_id, skill: skillKey, ok: emailResult.ok });
        sent++;
      } catch (e) {
        console.warn('bulk welcome failed for', p.id, e);
        failed++;
      }
    }

    return { ok: true, count: sent, failed, total: todays.length, details };
  });
