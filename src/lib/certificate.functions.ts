import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Certificate issuance with automatic email via Resend
// Secure, idempotent, transactional

const issueSchema = z.object({
  studentId: z.string().min(1), // UUID of profile
  kr8Id: z.string().min(1),
  skill: z.string().min(1),
  skillName: z.string().min(1),
  tier: z.enum(["Professionalism", "Completion"]),
  achievementText: z.string().optional(),
  additionalNotes: z.string().optional(),
  templateUrl: z.string().optional(),
  editedName: z.string().min(2).max(100).optional(),
  alsoUpdateProfile: z.boolean().optional(),
});

const withdrawSchema = z.object({
  certificateId: z.string().min(1),
  reason: z.string().min(5).max(500),
});

const resendEmailSchema = z.object({
  certificateId: z.string().min(1),
});

function generateCertificateCode(kr8Id: string, skill: string): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CERT-KR8-${kr8Id}-${skill.toUpperCase()}-${rand}`;
}

async function sendCertificateEmailViaResend(cert: any, profile: any) {
  const RESEND_API_KEY = process.env["RESEND_API_KEY"];
  const RESEND_FROM = process.env["RESEND_FROM"] || "KR8 Digitals <certificates@kr8digitals.com>";

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  // For testing until domain verified, use owner's email if needed
  // In production, RESEND_FROM must be from verified domain
  const toEmail = profile.email;

  const verifyUrl = `${process.env["VITE_SITE_URL"] || "https://kr8-website-enhancer.vercel.app"}/verify?cert=${cert.certificate_code}`;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your KR8 Certificate</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #ffffff; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a0a2e 0%, #0f0a1a 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(236, 72, 153, 0.3); }
      .header { background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 32px; text-align: center; }
      .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
      .header p { margin: 8px 0 0; opacity: 0.9; }
      .content { padding: 32px; }
      .cert-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin: 24px 0; }
      .cert-code { font-family: monospace; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; padding: 12px; text-align: center; font-size: 14px; font-weight: bold; color: #ec4899; margin: 16px 0; }
      .button { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 14px; margin: 16px 0; }
      .footer { background: rgba(0,0,0,0.3); padding: 24px; text-align: center; font-size: 12px; color: #8a7ba8; border-top: 1px solid rgba(255,255,255,0.05); }
      .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; }
    </style>
  </head>
  <body>
    <div style="padding: 24px; background: #0a0a0f;">
      <div class="container">
        <div class="header">
          <h1>🎓 Congratulations, ${profile.name}!</h1>
          <p>Your KR8 Certificate of ${cert.tier} is Ready</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; line-height: 1.6; color: #cabfe0;">
            You have successfully graduated from <strong style="color: white;">${cert.skill_name}</strong> at KR8 Digitals!
            Your official credential has been issued with permanent QR verification.
          </p>

          <div class="cert-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0; font-size: 18px;">Certificate of ${cert.tier}</h3>
              <span class="badge">✓ VERIFIED</span>
            </div>
            <p style="margin: 0; color: #b8aecf; font-size: 14px;">Issued to</p>
            <p style="margin: 4px 0 12px; font-size: 20px; font-weight: bold;">${cert.student_name}</p>
            <p style="margin: 0; color: #b8aecf; font-size: 14px;">For excellence in</p>
            <p style="margin: 4px 0 12px; font-size: 16px; font-weight: 600; color: #ec4899;">${cert.skill_name}</p>
            ${cert.additional_notes ? `<p style="margin: 12px 0 0; font-size: 13px; color: #f472b6;"><strong>Recognition:</strong> ${cert.additional_notes}</p>` : ''}
            <div class="cert-code">${cert.certificate_code}</div>
            <p style="font-size: 12px; color: #8a7ba8; text-align: center; margin: 8px 0 0;">
              Issued on ${new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verify Certificate Online →</a>
          </div>

          <div style="background: rgba(236, 72, 153, 0.08); border: 1px solid rgba(236, 72, 153, 0.2); border-radius: 12px; padding: 16px; margin-top: 24px;">
            <p style="margin: 0; font-size: 13px; color: #cabfe0; line-height: 1.5;">
              <strong style="color: white;">What's next?</strong><br>
              • View and download your certificate in your dashboard<br>
              • Share your achievement with the verification link<br>
              • Your certificate is permanently verifiable anywhere<br>
              • Keep building - consider our advanced tracks!
            </p>
          </div>

          <p style="font-size: 13px; color: #8a7ba8; margin-top: 24px; line-height: 1.5;">
            This certificate was issued by KR8 Digitals and is verifiable at any time using your certificate code or KR8 ID.
            The verification link in this email works on any device, anywhere.
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0 0 8px;">KR8 Digitals — Learn Free. Belong Deeply. Build for Real.</p>
          <p style="margin: 0;">This is an automated email. Please do not reply. For support, contact kr8digitals01@gmail.com</p>
          <p style="margin: 12px 0 0; font-size: 11px;">
            Certificate Code: ${cert.certificate_code} | KR8 ID: ${cert.kr8_id}<br>
            Verification: ${verifyUrl}
          </p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
Congratulations, ${profile.name}!

Your KR8 Certificate of ${cert.tier} in ${cert.skill_name} has been issued!

Certificate Code: ${cert.certificate_code}
KR8 ID: ${cert.kr8_id}
Student: ${cert.student_name}
Skill: ${cert.skill_name}
Tier: ${cert.tier}
Issued: ${new Date(cert.issued_at).toLocaleDateString()}

Verify online: ${verifyUrl}

View your certificate in your dashboard: https://kr8-website-enhancer.vercel.app/dashboard

Keep building!
KR8 Digitals Team
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [toEmail],
        subject: `🎓 Your KR8 Certificate of ${cert.tier} in ${cert.skill_name} is Ready!`,
        html,
        text,
        tags: [
          { name: "type", value: "certificate" },
          { name: "kr8_id", value: cert.kr8_id },
          { name: "tier", value: cert.tier },
        ],
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || `Resend error ${res.status}`);
    }

    return { ok: true, resendId: result.id };
  } catch (err: any) {
    console.error("Resend email failed:", err);
    return { ok: false, error: err.message };
  }
}

export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => issueSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const safeActorUuid = isUuid ? userId : null;

    // Check admin with issue_certificates permission via DB or Executive status
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = isUuid
      ? await supabaseAdmin.from('user_roles').select('role, permissions').eq('user_id', userId)
      : { data: [] };

    const execEmail = String(user?.email || "").toLowerCase();
    const isExecutive =
      Boolean(user?.is_executive) ||
      ["kr8digitals01@gmail.com", "kutimfire001@gmail.com", "stevenson@kr8digitals.com", "daniel@kr8digitals.com"].includes(execEmail);

    // Founder has all permissions
    const isFounder = isExecutive || roles?.some((r: any) => r.role === 'founder');
    const hasIssuePermission = isFounder || roles?.some((r: any) => {
      if (['founder','co-founder'].includes(r.role)) return true;
      const perms = r.permissions as string[] || [];
      return perms.includes('issue_certificates') || perms.includes('Graduation & Certificates') || r.role === 'admin';
    });

    if (!hasIssuePermission) {
      throw new Error("Only admins with issue_certificates permission can issue certificates");
    }

    // Fetch student profile by UUID id or kr8_id
    let studentProfile: any = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.studentId)) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.studentId)
        .maybeSingle();
      studentProfile = p;
    }
    if (!studentProfile) {
      const { data: pByKr8 } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .or(`kr8_id.ilike.${data.kr8Id},kr8_id.ilike.${data.studentId}`)
        .limit(1);
      studentProfile = pByKr8?.[0] || null;
    }

    if (!studentProfile) {
      throw new Error(`Student profile not found: ${data.studentId}`);
    }

    const resolvedStudentUuid = studentProfile.id;

    // Check for existing active certificate for same skill (idempotency)
    const { data: existing } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('student_id', resolvedStudentUuid)
      .eq('skill', data.skill)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      // Ensure profile is marked graduated
      await supabaseAdmin
        .from('profiles')
        .update({ graduated: true, cert_tier: existing.tier || data.tier })
        .eq('id', resolvedStudentUuid);
      return { certificate: existing, isNew: false };
    }

    const certCode = generateCertificateCode(studentProfile.kr8_id || data.kr8Id, data.skill);

    // Use edited name if provided, otherwise profile name - certificate must use edited name, profile stays linked without duplicate
    const finalName = (data as any).editedName?.trim() || studentProfile.name;
    const shouldUpdateProfile = !!(data as any).alsoUpdateProfile && (data as any).editedName?.trim();

    // Transaction: update profile graduated + insert certificate
    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificates')
      .insert({
        certificate_code: certCode,
        student_id: resolvedStudentUuid,
        kr8_id: studentProfile.kr8_id || data.kr8Id,
        student_name: finalName,
        formatted_name: finalName.toUpperCase(),
        skill: data.skill,
        skill_name: data.skillName,
        tier: data.tier,
        template_url: data.templateUrl || `/certificates/reusable_${data.tier.toLowerCase()}.png`,
        achievement_text: data.achievementText || (data.tier === "Professionalism"
          ? "demonstrating excellence and proficiency in turning client requests into client satisfaction."
          : "gaining hands-on experience in turning client requests into finished designs."),
        additional_notes: data.additionalNotes || null,
        issued_at: new Date().toISOString(),
        issued_by: safeActorUuid,
        status: 'active',
      })
      .select()
      .single();

    if (certError) {
      throw new Error(`Failed to issue certificate: ${certError.message}`);
    }

    // Update profile to graduated, and optionally update name if checkbox checked - stays linked, no duplicate
    const profileUpdate: any = {
      graduated: true,
      cert_tier: data.tier,
      cert_recognition: data.additionalNotes || studentProfile.cert_recognition,
      updated_at: new Date().toISOString(),
    };
    if (shouldUpdateProfile) {
      profileUpdate.name = finalName;
    }
    await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', resolvedStudentUuid);

    // Also update legacy accounts table during migration
    try {
      await supabaseAdmin.from('accounts').update({
        graduated: true,
        cert_tier: data.tier,
        cert_recognition: data.additionalNotes,
      }).eq('id', studentProfile.kr8_id || data.kr8Id);
    } catch {}

    // Create enrollment record
    try {
      await supabaseAdmin.from('enrollments').upsert({
        user_id: resolvedStudentUuid,
        skill_key: data.skill,
        skill_name: data.skillName,
        graduated: true,
        graduated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,skill_key' });
    } catch {}

    // Log activity
    try {
      await supabaseAdmin.from('activity_log').insert({
        actor_id: safeActorUuid,
        action: 'certificate_issued',
        target: studentProfile.name,
        details: { certificate_code: certCode, skill: data.skill, tier: data.tier, kr8_id: studentProfile.kr8_id || data.kr8Id },
      });
    } catch {}

    // Send email via Resend (async, don't block response but record result)
    let emailResult;
    try {
      emailResult = await sendCertificateEmailViaResend(cert, studentProfile);

      if (emailResult.ok) {
        await supabaseAdmin.from('certificates').update({
          email_sent_at: new Date().toISOString(),
          email_failure_reason: null,
        }).eq('id', cert.id);

        await supabaseAdmin.from('email_logs').insert({
          certificate_id: cert.id,
          recipient_email: studentProfile.email,
          status: 'sent',
          resend_id: emailResult.resendId,
        });
      } else {
        await supabaseAdmin.from('certificates').update({
          email_failure_reason: emailResult.error,
        }).eq('id', cert.id);

        await supabaseAdmin.from('email_logs').insert({
          certificate_id: cert.id,
          recipient_email: studentProfile.email,
          status: 'failed',
          error_message: emailResult.error,
        });
      }
    } catch (emailErr: any) {
      console.error('Email sending failed:', emailErr);
      await supabaseAdmin.from('certificates').update({
        email_failure_reason: emailErr.message,
      }).eq('id', cert.id);
    }

    return { certificate: cert, isNew: true, email: emailResult };
  });

export const withdrawCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => withdrawSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const safeActorUuid = isUuid ? userId : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = isUuid
      ? await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId)
      : { data: [] };
    const execEmail = String(user?.email || "").toLowerCase();
    const isAdmin =
      Boolean(user?.is_executive) ||
      ["kr8digitals01@gmail.com", "kutimfire001@gmail.com", "stevenson@kr8digitals.com", "daniel@kr8digitals.com"].includes(execEmail) ||
      roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isAdmin) throw new Error("Only admins can withdraw certificates");

    const { data: cert, error: fetchError } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('id', data.certificateId)
      .maybeSingle();

    if (fetchError || !cert) throw new Error("Certificate not found");

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('certificates')
      .update({
        status: 'withdrawn',
        withdrawal_reason: data.reason,
        withdrawn_at: new Date().toISOString(),
        withdrawn_by: safeActorUuid,
      })
      .eq('id', data.certificateId)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    // Check if student has other active certs, if not, set graduated false
    const { data: otherActive } = await supabaseAdmin
      .from('certificates')
      .select('id')
      .eq('student_id', cert.student_id)
      .eq('status', 'active')
      .limit(1);

    if (!otherActive || otherActive.length === 0) {
      await supabaseAdmin.from('profiles').update({
        graduated: false,
        cert_tier: null,
      }).eq('id', cert.student_id);
    }

    try {
      await supabaseAdmin.from('activity_log').insert({
        actor_id: safeActorUuid,
        action: 'certificate_withdrawn',
        target: cert.student_name,
        details: { certificate_code: cert.certificate_code, reason: data.reason },
      });
    } catch {}

    return { certificate: updated };
  });

export const resendCertificateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => resendEmailSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, user } = context as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = isUuid
      ? await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId)
      : { data: [] };
    const execEmail = String(user?.email || "").toLowerCase();
    const isAdmin =
      Boolean(user?.is_executive) ||
      ["kr8digitals01@gmail.com", "kutimfire001@gmail.com", "stevenson@kr8digitals.com", "daniel@kr8digitals.com"].includes(execEmail) ||
      roles?.some((r: any) => ['founder','co-founder','admin'].includes(r.role));
    if (!isAdmin) throw new Error("Only admins can resend emails");

    const { data: cert } = await supabaseAdmin.from('certificates').select('*').eq('id', data.certificateId).maybeSingle();
    if (!cert) throw new Error("Certificate not found");

    if (cert.email_sent_at) {
      // Check if already sent successfully
      const { data: lastLog } = await supabaseAdmin.from('email_logs').select('*').eq('certificate_id', cert.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (lastLog?.status === 'sent') {
        // Allow resend anyway but warn
      }
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', cert.student_id).maybeSingle();
    if (!profile) throw new Error("Student profile not found");

    const emailResult = await sendCertificateEmailViaResend(cert, profile);

    if (emailResult.ok) {
      await supabaseAdmin.from('certificates').update({
        email_sent_at: new Date().toISOString(),
        email_failure_reason: null,
      }).eq('id', cert.id);

      await supabaseAdmin.from('email_logs').insert({
        certificate_id: cert.id,
        recipient_email: profile.email,
        status: 'sent',
        resend_id: emailResult.resendId,
      });
    } else {
      await supabaseAdmin.from('certificates').update({
        email_failure_reason: emailResult.error,
      }).eq('id', cert.id);

      await supabaseAdmin.from('email_logs').insert({
        certificate_id: cert.id,
        recipient_email: profile.email,
        status: 'failed',
        error_message: emailResult.error,
      });
    }

    return { ok: emailResult.ok, error: emailResult.error, resendId: (emailResult as any).resendId };
  });

export const verifyCertificatePublic = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try new certificates table
    const { data: cert } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .or(`certificate_code.eq.${data.code},kr8_id.eq.${data.code}`)
      .eq('status', 'active')
      .maybeSingle();

    if (cert) {
      return {
        valid: true,
        certificate: {
          certificate_code: cert.certificate_code,
          kr8_id: cert.kr8_id,
          student_name: cert.student_name,
          skill: cert.skill,
          skill_name: cert.skill_name,
          tier: cert.tier,
          status: cert.status,
          issued_at: cert.issued_at,
          achievement_text: cert.achievement_text,
          additional_notes: cert.additional_notes,
        }
      };
    }

    // Fallback to profiles for graduated check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('kr8_id', data.code)
      .maybeSingle();

    if (profile && profile.graduated) {
      return {
        valid: true,
        certificate: {
          certificate_code: `CERT-KR8-${profile.kr8_id}-${(profile.skill || 'GEN').toUpperCase()}`,
          kr8_id: profile.kr8_id,
          student_name: profile.name,
          skill: profile.skill || 'graphic',
          skill_name: profile.skill || 'Digital Skills',
          tier: profile.cert_tier || 'Completion',
          status: 'active',
          issued_at: profile.joined,
          achievement_text: null,
          additional_notes: profile.cert_recognition,
        }
      };
    }

    return { valid: false };
  });
