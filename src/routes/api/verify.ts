import { createFileRoute } from "@tanstack/react-router";

// Public certificate verification - no auth required, returns safe fields only
// Uses SECURITY DEFINER RPCs to bypass RLS for anon users
// Validates input to prevent PostgREST filter injection

const CODE_REGEX = /^[A-Za-z0-9_-]{6,64}$/;

function isValidCode(code: string): boolean {
  return CODE_REGEX.test(code);
}

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawCode = (url.searchParams.get('code') || url.searchParams.get('id') || url.searchParams.get('cert') || '').trim();

        if (!rawCode) {
          return Response.json({ valid: false, error: "Missing code parameter" }, { status: 400 });
        }

        if (!isValidCode(rawCode)) {
          return Response.json({ valid: false, error: "Invalid code format. Use 6-64 alphanumeric, dash, underscore characters." }, { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Use RPC verify_certificate_public - secure, no injection, safe fields only
          // Try certificate code first
          const { data: certData, error: certError } = await supabaseAdmin.rpc('verify_certificate_public', { cert_code: rawCode });

          if (!certError && certData && Array.isArray(certData) && certData.length > 0) {
            const cert = certData[0];
            if (cert && cert.is_valid) {
              return Response.json({
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
                },
                type: 'certificate'
              });
            }
          }

          // Try separate eq queries to avoid injection - first try certificate_code eq
          const { data: certByCode } = await supabaseAdmin
            .from('certificates')
            .select('certificate_code,kr8_id,student_name,skill,skill_name,tier,status,issued_at,achievement_text,additional_notes')
            .eq('certificate_code', rawCode)
            .eq('status', 'active')
            .maybeSingle();

          if (certByCode) {
            return Response.json({
              valid: true,
              certificate: certByCode,
              type: 'certificate'
            });
          }

          // Then try kr8_id eq
          const { data: certByKr8 } = await supabaseAdmin
            .from('certificates')
            .select('certificate_code,kr8_id,student_name,skill,skill_name,tier,status,issued_at,achievement_text,additional_notes')
            .eq('kr8_id', rawCode)
            .eq('status', 'active')
            .maybeSingle();

          if (certByKr8) {
            return Response.json({
              valid: true,
              certificate: certByKr8,
              type: 'certificate'
            });
          }

          // Use RPC get_profile_by_kr8_id for public profile - safe fields only
          const { data: profileData, error: profileError } = await supabaseAdmin.rpc('get_profile_by_kr8_id', { lookup_id: rawCode });

          if (!profileError && profileData && Array.isArray(profileData) && profileData.length > 0) {
            const profile = profileData[0];
            if (profile) {
              // Student exists but not graduated -> show "in training" with public details
              return Response.json({
                valid: true,
                profile: {
                  kr8_id: profile.kr8_id,
                  name: profile.name,
                  skill: profile.skill,
                  graduated: profile.graduated,
                  cert_tier: profile.cert_tier,
                  joined: profile.joined,
                },
                type: profile.graduated ? 'graduated' : 'in_training',
                message: profile.graduated ? undefined : 'Student is currently in training'
              });
            }
          }

          // Fallback direct eq query for profile (service_role bypasses RLS, but safe fields only)
          const { data: profileByKr8 } = await supabaseAdmin
            .from('profiles')
            .select('kr8_id,name,skill,graduated,cert_tier,joined')
            .eq('kr8_id', rawCode)
            .maybeSingle();

          if (profileByKr8) {
            return Response.json({
              valid: true,
              profile: profileByKr8,
              type: profileByKr8.graduated ? 'graduated' : 'in_training',
              message: profileByKr8.graduated ? undefined : 'Student is currently in training'
            });
          }

          return Response.json({ valid: false, error: "Certificate or student not found" }, { status: 404 });

        } catch (err: any) {
          console.error('Verify API error:', err);
          return Response.json({ valid: false, error: "Verification failed" }, { status: 500 });
        }
      },
    },
  },
});
