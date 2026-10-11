import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { reconcileDatabaseState } from "@/lib/public-data.functions";

const SKILL_DISPLAY_NAMES: Record<string, string> = {
  graphic: "Graphic Design",
  video: "Video Editing & Animation",
  web: "Website Development",
  frontend: "Front-End Development",
  content_creation: "Content Creation",
  smm: "Social Media Management",
  marketing: "Digital Marketing",
};

const EXECUTIVE_PROFILES: Record<string, any> = {
  "KR8-FOUNDER-TIMFIRE": {
    id: "KR8-FOUNDER-TIMFIRE",
    kr8_id: "KR8-FOUNDER-TIMFIRE",
    name: "Kenneth Timothy Iziogo (Timfire)",
    type: "founder",
    executiveRole: "Founder",
    title: "Founder & CEO",
    skill: "web",
    skill_name: "Website Development & Architecture",
    graduated: true,
    cert_tier: "Professionalism",
    cert_recognition: "Founder & Lead Architect of KR8 Digitals",
    points: 1000,
    attendance_accepted: 24,
    submissions: 16,
    referrals: 50,
    cohort_year: 2026,
    avatar: "/founder_timfire.jpg",
    bio: "Founder & CEO of KR8 Digitals. Dedicated to democratizing high-income creative and engineering education across Africa.",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  "KR8-COFOUNDER-STEVENSON": {
    id: "KR8-COFOUNDER-STEVENSON",
    kr8_id: "KR8-COFOUNDER-STEVENSON",
    name: "Stevenson (Motionverse)",
    type: "co-founder",
    executiveRole: "Co-Founder",
    title: "Co-Founder · Media Director",
    skill: "graphic",
    skill_name: "Graphic Design & Brand Identity",
    graduated: true,
    cert_tier: "Professionalism",
    cert_recognition: "Co-Founder & Lead Graphic Design Director (Motionverse)",
    points: 850,
    attendance_accepted: 20,
    submissions: 14,
    referrals: 35,
    cohort_year: 2026,
    avatar: "/team/stevenson.jpg",
    bio: "Co-Founder & Media Director at KR8 Digitals, leading Graphic Design under his creative studio, Motionverse.",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  "KR8-COFOUNDER-DANIEL": {
    id: "KR8-COFOUNDER-DANIEL",
    kr8_id: "KR8-COFOUNDER-DANIEL",
    name: "Daniel (Creative Expression)",
    type: "co-founder",
    executiveRole: "Co-Founder",
    title: "Co-Founder · COO",
    skill: "video",
    skill_name: "Video Editing & Animation",
    graduated: true,
    cert_tier: "Professionalism",
    cert_recognition: "Co-Founder & Lead Video Editing Director (Creative Expression)",
    points: 850,
    attendance_accepted: 20,
    submissions: 14,
    referrals: 35,
    cohort_year: 2026,
    avatar: "/team/daniel.jpg",
    bio: "Co-Founder & COO at KR8 Digitals, heading Video Editing & Animation under his studio, Creative Expression.",
    created_at: "2026-01-01T00:00:00.000Z",
  },
};

function sanitizeLookupCode(rawInput: string): string {
  let s = (rawInput || "").trim();
  if (!s) return "";
  // If user pasted a full URL (e.g. https://.../verify?id=... or ?cert=...), extract the parameter
  if (s.includes("?") || s.includes("http://") || s.includes("https://")) {
    try {
      const url = new URL(s.startsWith("http") ? s : `https://kr8digitals.com/${s}`);
      const param =
        url.searchParams.get("cert") ||
        url.searchParams.get("code") ||
        url.searchParams.get("id");
      if (param) s = param.trim();
    } catch {}
  }
  return s.replace(/\s+/g, "");
}

function mapDbCertToFrontend(c: any) {
  const tier = c.tier === "Completion" ? "Completion" : "Professionalism";
  return {
    id: c.certificate_code || c.id,
    certificate_code: c.certificate_code || c.id,
    studentId: c.kr8_id || c.student_id,
    kr8_id: c.kr8_id || c.student_id,
    studentName: c.student_name,
    student_name: c.student_name,
    formattedName: c.formatted_name || String(c.student_name || "").toUpperCase(),
    skill: c.skill || "graphic",
    skillName: c.skill_name || SKILL_DISPLAY_NAMES[c.skill] || c.skill || "Digital Skills",
    skill_name: c.skill_name || SKILL_DISPLAY_NAMES[c.skill] || c.skill || "Digital Skills",
    tier,
    templateUrl: c.template_url || `/certificates/reusable_${tier.toLowerCase()}.png`,
    achievementText:
      c.achievement_text ||
      (tier === "Professionalism"
        ? "demonstrating excellence and proficiency in turning client requests into client satisfaction."
        : "gaining hands-on experience in turning client requests into finished designs."),
    additionalNotes: c.additional_notes || undefined,
    additional_notes: c.additional_notes || null,
    issuedAt: c.issued_at ? new Date(c.issued_at).getTime() : Date.now(),
    issued_at: c.issued_at || new Date().toISOString(),
    status: c.status === "withdrawn" ? "withdrawn" : "active",
    withdrawalReason: c.withdrawal_reason || undefined,
    withdrawal_reason: c.withdrawal_reason || null,
    withdrawnAt: c.withdrawn_at ? new Date(c.withdrawn_at).getTime() : undefined,
    withdrawn_at: c.withdrawn_at || null,
  };
}

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const rawCode =
            url.searchParams.get("code") ||
            url.searchParams.get("id") ||
            url.searchParams.get("cert") ||
            "";
          const code = sanitizeLookupCode(rawCode);

          if (!code || code.length < 3) {
            return json(
              { ok: false, error: "Please enter a valid KR8 ID or Certificate Code." },
              { status: 400 }
            );
          }

          try {
            await Promise.race([
              reconcileDatabaseState(false),
              new Promise((r) => setTimeout(r, 1200)),
            ]);
          } catch {}
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const upperCode = code.toUpperCase();
          const cleanAlphaNum = upperCode.replace(/[^A-Z0-9]/g, "");

          // Check Executive canonical IDs
          let execFallback: any = null;
          if (upperCode === "KR8-FOUNDER-TIMFIRE" || cleanAlphaNum === "KR8FOUNDERTIMFIRE") {
            execFallback = EXECUTIVE_PROFILES["KR8-FOUNDER-TIMFIRE"];
          } else if (upperCode === "KR8-COFOUNDER-STEVENSON" || cleanAlphaNum === "KR8COFOUNDERSTEVENSON") {
            execFallback = EXECUTIVE_PROFILES["KR8-COFOUNDER-STEVENSON"];
          } else if (upperCode === "KR8-COFOUNDER-DANIEL" || cleanAlphaNum === "KR8COFOUNDERDANIEL") {
            execFallback = EXECUTIVE_PROFILES["KR8-COFOUNDER-DANIEL"];
          }

          let allCertsForStudent: any[] = [];
          let profile: any = null;

          // Run DB queries with a fast 2.5s budget so /api/verify always responds rapidly
          await Promise.race([
            (async () => {
              try {
                // 1. Search certificates by certificate_code or kr8_id
                const { data: matchedCerts } = await supabaseAdmin
                  .from("certificates")
                  .select("*")
                  .or(`certificate_code.ilike.${code},kr8_id.ilike.${code},kr8_id.ilike.${cleanAlphaNum}`)
                  .order("issued_at", { ascending: false });

                if (matchedCerts) allCertsForStudent = [...matchedCerts];

                // 2. Search profile by kr8_id, UUID, or from matched certificate
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
                if (isUuid) {
                  const { data: byId } = await supabaseAdmin
                    .from("profiles")
                    .select("*")
                    .eq("id", code)
                    .maybeSingle();
                  if (byId) profile = byId;
                }

                if (!profile) {
                  const { data: byKr8 } = await supabaseAdmin
                    .from("profiles")
                    .select("*")
                    .or(`kr8_id.ilike.${code},kr8_id.ilike.${cleanAlphaNum}`)
                    .limit(1)
                    .maybeSingle();
                  if (byKr8) profile = byKr8;
                }

                if (!profile && allCertsForStudent.length > 0) {
                  const firstCert = allCertsForStudent[0];
                  if (firstCert.student_id) {
                    const { data: byCertUid } = await supabaseAdmin
                      .from("profiles")
                      .select("*")
                      .eq("id", firstCert.student_id)
                      .maybeSingle();
                    if (byCertUid) profile = byCertUid;
                  }
                  if (!profile && firstCert.kr8_id) {
                    const { data: byCertKr8 } = await supabaseAdmin
                      .from("profiles")
                      .select("*")
                      .ilike("kr8_id", firstCert.kr8_id)
                      .limit(1)
                      .maybeSingle();
                    if (byCertKr8) profile = byCertKr8;
                  }
                }

                if (profile) {
                  const { data: extraCerts } = await supabaseAdmin
                    .from("certificates")
                    .select("*")
                    .or(`student_id.eq.${profile.id},kr8_id.ilike.${profile.kr8_id}`)
                    .order("issued_at", { ascending: false });
                  if (extraCerts && extraCerts.length > 0) {
                    const map = new Map<string, any>();
                    [...allCertsForStudent, ...extraCerts].forEach((c) =>
                      map.set(c.certificate_code || c.id, c)
                    );
                    allCertsForStudent = Array.from(map.values());
                  }
                }
              } catch {}
            })(),
            new Promise((r) => setTimeout(r, 2500)),
          ]);

          if (!profile && execFallback) {
            profile = { ...execFallback };
          }

          if (!profile && allCertsForStudent.length === 0) {
            try {
              const { verifyId } = await import("@/kr8/data/store");
              const localRes = verifyId(code);
              if (localRes.ok && localRes.account) {
                const acc = localRes.account;
                const cert = localRes.certificate;
                return json({
                  ok: true,
                  found: true,
                  account: acc,
                  profile: acc,
                  certificate: cert || null,
                  certificates: localRes.certificates || (cert ? [cert] : []),
                  remarks: [],
                  isWithdrawn: Boolean(localRes.isWithdrawn),
                  withdrawalReason: localRes.withdrawalReason || null,
                  withdrawnAt: localRes.withdrawnAt || null,
                });
              }
            } catch {}

            return json(
              {
                ok: false,
                found: false,
                error: "No student profile or certificate found matching that ID.",
              },
              { status: 404 }
            );
          }

          // Fetch user roles & enrollments if profile has a UUID id
          let rolesList: string[] = [];
          let enrollmentsList: any[] = [];
          if (profile?.id && /^[0-9a-f-]{36}$/i.test(profile.id)) {
            const [{ data: rData }, { data: eData }] = await Promise.all([
              supabaseAdmin.from("user_roles").select("role").eq("user_id", profile.id),
              supabaseAdmin.from("enrollments").select("*").eq("user_id", profile.id),
            ]);
            rolesList = (rData || []).map((r: any) => r.role);
            enrollmentsList = eData || [];
          }

          // If profile is graduated (or executive) and has no certificate row yet, synthesize one
          if (profile && (profile.graduated || execFallback) && allCertsForStudent.length === 0) {
            const skillKey = profile.skill || "graphic";
            const skillName =
              profile.skill_name || SKILL_DISPLAY_NAMES[skillKey] || skillKey;
            const tier = profile.cert_tier === "Completion" ? "Completion" : "Professionalism";
            allCertsForStudent.push({
              id: `CERT-KR8-${profile.kr8_id}-${skillKey.toUpperCase()}`,
              certificate_code: `CERT-KR8-${profile.kr8_id}-${skillKey.toUpperCase()}`,
              student_id: profile.id,
              kr8_id: profile.kr8_id,
              student_name: profile.name,
              formatted_name: String(profile.name || "").toUpperCase(),
              skill: skillKey,
              skill_name: skillName,
              tier,
              template_url: `/certificates/reusable_${tier.toLowerCase()}.png`,
              achievement_text:
                tier === "Professionalism"
                  ? "demonstrating excellence and proficiency in turning client requests into client satisfaction."
                  : "gaining hands-on experience in turning client requests into finished designs.",
              additional_notes: profile.cert_recognition || null,
              issued_at: profile.created_at || new Date().toISOString(),
              status: "active",
            });
          }

          const mappedCerts = allCertsForStudent.map(mapDbCertToFrontend);
          // Match specific certificate if queried by CERT-..., else prefer active certificate
          let primaryCert = mappedCerts.find(
            (c) => String(c.certificate_code).toUpperCase() === upperCode
          );
          if (!primaryCert && mappedCerts.length > 0) {
            primaryCert =
              mappedCerts.find((c) => c.status === "active") || mappedCerts[0];
          }

          // Fetch public verify remarks for student kr8_id and certificate_code
          const remarkTargets = new Set<string>([upperCode]);
          if (profile?.kr8_id) remarkTargets.add(String(profile.kr8_id).toUpperCase());
          if (primaryCert?.certificate_code) {
            remarkTargets.add(String(primaryCert.certificate_code).toUpperCase());
          }
          let publicRemarks: any[] = [];
          if (profile?.id && /^[0-9a-f-]{36}$/i.test(profile.id)) {
            try {
              const { data: remData }: any = await Promise.race([
                supabaseAdmin
                  .from("verify_remarks")
                  .select("id, target_type, target_id, remark, created_at")
                  .eq("visible_public", true)
                  .order("created_at", { ascending: false }),
                new Promise((r) => setTimeout(() => r({ data: [] }), 800)),
              ]);
              publicRemarks = (remData || []).filter((r: any) =>
                remarkTargets.has(String(r.target_id || "").toUpperCase())
              );
            } catch {}
          }

          // Determine account type (founder, co-founder, tribe, student)
          const emailLower = String(profile?.email || "").toLowerCase();
          const isFounder =
            execFallback?.type === "founder" ||
            rolesList.includes("founder") ||
            emailLower === "kr8digitals01@gmail.com" ||
            emailLower === "kutimfire001@gmail.com";
          const isCoFounder =
            !isFounder &&
            (execFallback?.type === "co-founder" || rolesList.includes("co-founder"));
          const isTribe =
            !isFounder &&
            !isCoFounder &&
            (rolesList.includes("tribe") && !rolesList.includes("student") && !profile?.skill);

          const accountType = isFounder
            ? "founder"
            : isCoFounder
            ? "co-founder"
            : isTribe
            ? "tribe"
            : "student";

          const effectiveSkill = profile?.skill || primaryCert?.skill || "graphic";
          const effectiveSkillName =
            SKILL_DISPLAY_NAMES[effectiveSkill] ||
            primaryCert?.skillName ||
            effectiveSkill;

          const skillsSet = new Set<string>([effectiveSkill]);
          enrollmentsList.forEach((e: any) => {
            if (e.skill_key) skillsSet.add(e.skill_key);
          });
          mappedCerts.forEach((c: any) => {
            if (c.skill) skillsSet.add(c.skill);
          });

          const isGraduated = Boolean(
            profile?.graduated || mappedCerts.some((c) => c.status === "active")
          );

          const normalizedAccount = {
            id: profile?.kr8_id || primaryCert?.kr8_id || code,
            kr8_id: profile?.kr8_id || primaryCert?.kr8_id || code,
            userId: profile?.id || primaryCert?.studentId,
            type: accountType,
            executiveRole: isFounder ? "Founder" : isCoFounder ? "Co-Founder" : undefined,
            title: isFounder
              ? "Founder & CEO"
              : isCoFounder
              ? execFallback?.title || "Co-Founder"
              : undefined,
            name: profile?.name || primaryCert?.studentName || "KR8 Scholar",
            skill: effectiveSkill,
            skillName: effectiveSkillName,
            skills: Array.from(skillsSet),
            multiSkillCount: Math.max(1, skillsSet.size),
            year: profile?.cohort_year || 2026,
            points: Number(profile?.points || (isGraduated ? 250 : 0)),
            attendanceAccepted: Number(profile?.attendance_accepted || (isGraduated ? 12 : 0)),
            submissions: Number(profile?.submissions || (isGraduated ? 6 : 0)),
            referrals: Number(profile?.referrals || 0),
            graduated: isGraduated,
            certTier:
              primaryCert?.tier ||
              profile?.cert_tier ||
              (isGraduated ? "Professionalism" : null),
            certRecognition:
              primaryCert?.additionalNotes ||
              profile?.cert_recognition ||
              publicRemarks[0]?.remark ||
              undefined,
            verifyRemark:
              publicRemarks.map((r) => r.remark).join(" • ") ||
              profile?.cert_recognition ||
              primaryCert?.additionalNotes ||
              undefined,
            avatar: profile?.avatar || execFallback?.avatar || null,
            bio: profile?.bio || execFallback?.bio || null,
            joined: profile?.created_at
              ? new Date(profile.created_at).getTime()
              : Date.now(),
            created_at: profile?.created_at || primaryCert?.issued_at,
            certificates: mappedCerts,
          };

          return json({
            ok: true,
            found: true,
            type: primaryCert ? "certificate" : "profile",
            account: normalizedAccount,
            profile: normalizedAccount,
            certificate: primaryCert || null,
            certificates: mappedCerts,
            remarks: publicRemarks,
            isWithdrawn: primaryCert ? primaryCert.status === "withdrawn" : false,
            withdrawalReason: primaryCert?.withdrawalReason,
            withdrawnAt: primaryCert?.withdrawnAt,
          });
        } catch (err: any) {
          console.error("Verify API error:", err);
          return json(
            { ok: false, error: "Verification service encountered an error. Please try again." },
            { status: 500 }
          );
        }
      },
    },
  },
});
