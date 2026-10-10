import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const welcomeSchema = z.object({
  userId: z.string().uuid(),
  skillKey: z.string().min(1).max(50).optional(),
});

async function sendWelcomeEmailViaResend(profile: any, whatsappUrl: string, skillName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "KR8 Digitals <noreply@kr8digitals.com>";
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping welcome email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0015;color:#fff;padding:32px;border-radius:24px">
        <div style="text-align:center;margin-bottom:24px">
          <img src="https://www.kr8digitals.com/branding/kr8_logo.png" alt="KR8" style="height:48px" />
          <h1 style="font-size:28px;font-weight:900;margin:16px 0 8px">Welcome to KR8 Digitals, ${profile.name}! 🎉</h1>
          <p style="color:#cabfe0;font-size:14px">Your tuition-free seat for <strong style="color:#fff">${skillName}</strong> is confirmed.</p>
        </div>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;margin:20px 0">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;color:#8a7ba8;font-weight:700">Your KR8 ID</p>
          <p style="font-family:monospace;font-size:18px;font-weight:900;color:#ff6b9d;margin:0">${profile.kr8_id}</p>
          <p style="font-size:12px;color:#8a7ba8;margin:8px 0 0">Keep this safe — it's your verifiable proof of craft.</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${whatsappUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff2e93,#7c3aed);color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:800;font-size:14px">Join Your Learning Group on WhatsApp →</a>
          <p style="font-size:12px;color:#8a7ba8;margin:12px 0 0">For ${skillName} — click to join your cohort group</p>
        </div>
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0;font-size:13px;color:#a7f3d0"><strong>Next steps:</strong><br/>
          1. Join WhatsApp group above (your tribe awaits)<br/>
          2. Mark attendance: Mon/Wed/Fri 9PM-12AM class, Tue/Thu/Sat assignments<br/>
          3. Join live: Mindset Shift 1st & 3rd Sundays, Hangout last Sunday 7PM-11PM — auto attendance 10PM-11PM<br/>
          4. Build portfolio, climb leaderboard, graduate with QR-verified certificate</p>
        </div>
        <p style="font-size:11px;color:#6a5b82;text-align:center;margin-top:24px">You received this because you registered at kr8digitals.com<br/>If you didn't register, ignore this email.</p>
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

    // Only allow self or admin
    const { data: callerRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', callerId);
    const isAdmin = callerRoles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (callerId !== userId && !isAdmin) throw new Error("Unauthorized");

    const { data: profile } = await supabaseAdmin.from('profiles').select('id,kr8_id,name,email,skill').eq('id', userId).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const effectiveSkill = skillKey || profile.skill || 'graphic';
    // Fetch whatsapp_url from skill_settings
    const { data: skillSetting } = await supabaseAdmin.from('skill_settings').select('skill_key,name,whatsapp_url').eq('skill_key', effectiveSkill).maybeSingle();
    const whatsappUrl = skillSetting?.whatsapp_url || 'https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH';
    const skillName = skillSetting?.name || effectiveSkill;

    // Insert notification with clickable link
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: `Welcome to KR8 ${skillName}! Join your WhatsApp group`,
        message: `Your KR8 ID ${profile.kr8_id} is ready! Click to join your ${skillName} learning group: ${whatsappUrl} — Your dashboard updates after attendance approval. Mindset Shift 1st & 3rd Sundays, Hangout last Sunday 7PM-11PM auto-marked via live.`,
        type: 'welcome',
        read: false,
        link: whatsappUrl,
      });
    } catch (e) {
      console.warn('notification insert failed', e);
      // Try legacy table name
      try {
        await supabaseAdmin.from('student_notifications').insert({
          student_id: userId,
          title: `Join ${skillName} WhatsApp`,
          message: `Welcome! Join here: ${whatsappUrl}`,
        });
      } catch {}
    }

    // Send email via Resend
    const emailResult = await sendWelcomeEmailViaResend(profile, whatsappUrl, skillName);

    // Log activity
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

// Bulk resend for today's registrations (admin only)
export const bulkWelcomeToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callerId = (context as any).userId;
    const { data: callerRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', callerId);
    const isAdmin = callerRoles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isAdmin) throw new Error("Only admin/founder can bulk welcome");

    // Get profiles created today (last 24h)
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: todays } = await supabaseAdmin.from('profiles').select('id,kr8_id,name,email,skill,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(100);
    if (!todays || todays.length === 0) return { ok: true, count: 0, message: "No registrations in last 24h" };

    let sent = 0;
    let failed = 0;
    for (const p of todays) {
      try {
        const skillKey = p.skill || 'graphic';
        const { data: skillSetting } = await supabaseAdmin.from('skill_settings').select('name,whatsapp_url').eq('skill_key', skillKey).maybeSingle();
        const whatsappUrl = skillSetting?.whatsapp_url || 'https://chat.whatsapp.com/DgnBOEd5CfMHV8CTWgPNLH';
        const skillName = skillSetting?.name || skillKey;

        await supabaseAdmin.from('notifications').insert({
          user_id: p.id,
          title: `Welcome to KR8 ${skillName}! Join WhatsApp`,
          message: `Your KR8 ID ${p.kr8_id} — Join your ${skillName} group: ${whatsappUrl}`,
          type: 'welcome',
          read: false,
          link: whatsappUrl,
        });

        await sendWelcomeEmailViaResend(p, whatsappUrl, skillName);
        sent++;
      } catch (e) {
        console.warn('bulk welcome failed for', p.id, e);
        failed++;
      }
    }

    return { ok: true, count: sent, failed, total: todays.length };
  });
